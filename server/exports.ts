import { resolveSnapshot } from '../src/data/snapshot.js'
import type { SnapshotQuestion } from '../src/data/snapshot.js'
import type { AnswerValue } from '../src/data/types.js'
import { STRINGS, format } from '../src/data/strings.js'
import type { ResponseRow } from './responsesRepository.js'
import { toCsv } from './csv.js'
import {
  buildSpine,
  dates,
  formatNumber,
  identificationColumns,
  identificationLabel,
  mean,
  median,
  questionKey,
  renderChoiceTexts,
  scaleRowEntries,
  wasAskedOpenQuestion,
} from './exportModel.js'
import type { SpineQuestion } from './exportModel.js'

/**
 * The two downloads, both pure functions over the rows.
 *
 * `buildMatrixCsv` is the raw material: one line per respondent, questions as
 * headers, answers in plain text. It is what any later analysis starts from,
 * because it is the only one that keeps one person's answers associated with
 * each other — frequencies can always be derived from it, never the reverse.
 *
 * `buildFrequencyCsv` is the one that reads: every question, every option and
 * how many people chose it.
 *
 * Both render from each response's OWN snapshot, never from the current
 * questionnaire files, so a reworded question does not retroactively change
 * historical data.
 *
 * Hard rule, unchanged: no answer is ever silently dropped. A value that
 * cannot be resolved against its snapshot is emitted raw and flagged in the
 * `Sin resolver` column.
 */

const E = STRINGS.exports

const SEPARATOR = '\u0000'

// ─── The matrix ─────────────────────────────────────────────────────────────

interface MatrixColumn {
  key: string
  header: string
  /** The question it belongs to, for the disambiguation pass. */
  questionId: string
}

/**
 * One column per answerable thing, headed by the question's `label`.
 *
 * `label`, not `text`: `text` is the full wording, and for the four price
 * questions it is four near-identical sentences that a spreadsheet truncates
 * to the same prefix. `label` is «Precio: demasiado barato» — the distinction
 * you actually need in a column header. `types.ts` documents it as exactly
 * this. The full wording is in the frequency file, where there is room.
 */
function matrixColumns(spine: SpineQuestion[], overflow: Set<string>): MatrixColumn[] {
  const columns: MatrixColumn[] = []

  for (const question of spine) {
    const at = (suffix: string, header: string) =>
      columns.push({ key: `${question.key}${SEPARATOR}${suffix}`, header, questionId: question.id })

    if (question.type === 'multi_choice' && question.options.length > 0) {
      for (const option of question.options) {
        at(option.id, format(E.gridColumn, { label: question.label, row: option.text }))
      }
    } else if (question.type === 'scale_grid' && question.rows.length > 0) {
      for (const row of question.rows) {
        at(row.id, format(E.gridColumn, { label: question.label, row: row.text }))
      }
    } else if (question.type === 'number' && question.unit) {
      columns.push({
        key: question.key,
        header: format(E.withUnit, { label: question.label, unit: question.unit }),
        questionId: question.id,
      })
    } else {
      columns.push({ key: question.key, header: question.label, questionId: question.id })
    }

    // Only when something actually landed there, so the ordinary export is
    // not carrying an empty column for a case that never happened.
    if (overflow.has(question.key)) {
      at('', format(E.overflow, { label: question.label }))
    }
  }

  // Two different questions can carry the same label. Disambiguate only the
  // ones that collide, so the common case stays readable.
  const tally = new Map<string, number>()
  for (const column of columns) tally.set(column.header, (tally.get(column.header) ?? 0) + 1)
  return columns.map((column) =>
    (tally.get(column.header) ?? 0) > 1
      ? { ...column, header: format(E.disambiguate, { label: column.header, id: column.questionId }) }
      : column,
  )
}

/** An answer no snapshot explains, rendered so nothing is lost. */
function renderRaw(answer: AnswerValue): string {
  switch (answer.kind) {
    case 'option':
      return answer.optionId
    case 'options':
      return answer.optionIds.join(' | ')
    case 'number':
      return formatNumber(answer.value)
    case 'text':
      return answer.value
    case 'scaleRows':
      return Object.entries(answer.values)
        .map(([rowId, value]) => `${rowId}=${value}`)
        .join(' | ')
  }
}

/** Which questions need an overflow column, decided before any column exists. */
function overflowKeys(rows: ResponseRow[], spine: SpineQuestion[]): Set<string> {
  const byKey = new Map(spine.map((question) => [question.key, question]))
  const keys = new Set<string>()

  for (const row of rows) {
    const snapshot = row.questionnaire ? resolveSnapshot(row.questionnaire) : new Map()
    for (const [id, answer] of Object.entries(row.answers ?? {})) {
      const question: SnapshotQuestion | undefined = snapshot.get(id)
      if (!question) continue
      const key = questionKey(question)
      const spineQuestion = byKey.get(key)
      if (!spineQuestion) continue

      if (answer.kind === 'options' && spineQuestion.options.length > 0) {
        const known = new Set(spineQuestion.options.map((option) => option.id))
        if (answer.optionIds.some((optionId) => !known.has(optionId))) keys.add(key)
      }
      if (answer.kind === 'scaleRows' && spineQuestion.rows.length > 0) {
        const known = new Set(spineQuestion.rows.map((gridRow) => gridRow.id))
        if (Object.keys(answer.values).some((rowId) => !known.has(rowId))) keys.add(key)
      }
    }
  }

  return keys
}

/** One line per respondent. The data matrix any analysis starts from. */
export function buildMatrixCsv(rows: ResponseRow[]): string {
  const spine = buildSpine(rows)
  const byKey = new Map(spine.map((question) => [question.key, question]))
  const columns = matrixColumns(spine, overflowKeys(rows, spine))
  const idColumns = identificationColumns(rows)
  const askedOpen = rows.some((row) => wasAskedOpenQuestion(row.questionnaire, row.open_answer))

  const headers = [
    ...idColumns.map(identificationLabel),
    E.date,
    ...columns.map((column) => column.header),
    ...(askedOpen ? [E.openAnswer] : []),
    E.dateIso,
    E.audience,
    E.version,
    E.responseId,
    E.unresolved,
  ]

  const body = rows.map((row) => {
    const snapshot = row.questionnaire ? resolveSnapshot(row.questionnaire) : new Map()
    const { iso, human } = dates(row)
    const cells = new Map<string, string>()
    let unresolved = false

    for (const [id, answer] of Object.entries(row.answers ?? {})) {
      const question: SnapshotQuestion | undefined = snapshot.get(id)
      if (!question) {
        // Orphan: the spine gave it a column of its own, keyed by bare id.
        cells.set(id, renderRaw(answer))
        unresolved = true
        continue
      }

      const key = questionKey(question)
      const spineQuestion = byKey.get(key)
      const cell = (suffix: string, value: string) => cells.set(`${key}${SEPARATOR}${suffix}`, value)

      if (answer.kind === 'options' && spineQuestion && spineQuestion.options.length > 0) {
        // Three states, and the middle one is the whole point. Blank is "was
        // never offered this" — 15 consumer questions hang off a single
        // condition, so writing `No` there would invent half the sample.
        const offered = new Set((question.options ?? []).map((option) => option.id))
        const chosen = new Set(answer.optionIds)
        for (const option of spineQuestion.options) {
          if (!offered.has(option.id)) continue
          cell(option.id, chosen.has(option.id) ? E.yes : E.no)
        }
        const extra = answer.optionIds.filter((optionId) => !offered.has(optionId))
        if (extra.length > 0) {
          cell('', extra.join(' | '))
          unresolved = true
        }
        continue
      }

      if (answer.kind === 'scaleRows' && spineQuestion && spineQuestion.rows.length > 0) {
        const known = new Set(spineQuestion.rows.map((gridRow) => gridRow.id))
        const extra: string[] = []
        for (const entry of scaleRowEntries(question, answer)) {
          if (known.has(entry.rowId) && entry.text !== null) {
            cell(entry.rowId, formatNumber(entry.value))
          } else {
            extra.push(`${entry.rowId}=${entry.value}`)
          }
        }
        if (extra.length > 0) {
          cell('', extra.join(' | '))
          unresolved = true
        }
        continue
      }

      switch (answer.kind) {
        case 'option': {
          const { texts, unresolved: bad } = renderChoiceTexts(question, [answer.optionId])
          if (bad) unresolved = true
          cells.set(key, texts[0] ?? '')
          break
        }
        case 'options': {
          const { texts, unresolved: bad } = renderChoiceTexts(question, answer.optionIds)
          if (bad) unresolved = true
          cells.set(key, texts.join(' | '))
          break
        }
        case 'number':
          cells.set(key, formatNumber(answer.value))
          break
        case 'text':
          cells.set(key, answer.value)
          break
        case 'scaleRows':
          cells.set(key, renderRaw(answer))
          unresolved = true
          break
      }
    }

    return [
      ...idColumns.map((key) => row.identification?.[key] ?? ''),
      human,
      ...columns.map((column) => cells.get(column.key) ?? ''),
      ...(askedOpen ? [row.open_answer ?? ''] : []),
      iso,
      audienceLabel(row.respondent_type),
      row.questionnaire_version,
      row.id,
      unresolved ? E.yes : '',
    ]
  })

  return toCsv(headers, body)
}

export type ExportFormat = 'matrix' | 'frequency'

/** `respuestas-empresas.csv`: the file says whose answers it holds. */
export function exportFilename(shape: ExportFormat, audience: string | null): string {
  const what = shape === 'matrix' ? E.fileMatrix : E.fileFrequency
  const who =
    audience === 'company'
      ? E.fileCompany
      : audience === 'individual'
        ? E.fileIndividual
        : E.fileAll
  return `${what}-${who}.csv`
}

function audienceLabel(audience: string): string {
  if (audience === 'company') return STRINGS.admin.company
  if (audience === 'individual') return STRINGS.admin.individual
  return audience
}

// ─── The frequency table ────────────────────────────────────────────────────

interface Tally {
  /** Respondents who gave any answer to this question. */
  answered: number
  /** Chosen count per option id. */
  options: Map<string, number>
  /** Ratings per grid row id. */
  rows: Map<string, number[]>
  /** Every numeric value, for `scale` and `number`. */
  values: number[]
  /** Free-text answers that were not blank. */
  written: number
  /** Raw ids no snapshot explained, with how often they appeared. */
  unresolved: Map<string, number>
}

function emptyTally(): Tally {
  return {
    answered: 0,
    options: new Map(),
    rows: new Map(),
    values: [],
    written: 0,
    unresolved: new Map(),
  }
}

function bump(counter: Map<string, number>, key: string): void {
  counter.set(key, (counter.get(key) ?? 0) + 1)
}

function tallyAll(rows: ResponseRow[], spine: SpineQuestion[]): Map<string, Tally> {
  const byKey = new Map(spine.map((question) => [question.key, question]))
  const tallies = new Map<string, Tally>(spine.map((question) => [question.key, emptyTally()]))

  for (const row of rows) {
    const snapshot = row.questionnaire ? resolveSnapshot(row.questionnaire) : new Map()

    for (const [id, answer] of Object.entries(row.answers ?? {})) {
      const question: SnapshotQuestion | undefined = snapshot.get(id)
      const key = question ? questionKey(question) : id
      const tally = tallies.get(key)
      if (!tally) continue
      const spineQuestion = byKey.get(key)
      tally.answered += 1

      switch (answer.kind) {
        case 'option':
          if (spineQuestion?.options.some((option) => option.id === answer.optionId)) {
            bump(tally.options, answer.optionId)
          } else {
            bump(tally.unresolved, answer.optionId)
          }
          break

        case 'options':
          for (const optionId of answer.optionIds) {
            if (spineQuestion?.options.some((option) => option.id === optionId)) {
              bump(tally.options, optionId)
            } else {
              bump(tally.unresolved, optionId)
            }
          }
          break

        case 'number':
          tally.values.push(answer.value)
          break

        case 'text':
          if (answer.value.trim() !== '') tally.written += 1
          break

        case 'scaleRows':
          for (const entry of scaleRowEntries(question, answer)) {
            if (spineQuestion?.rows.some((gridRow) => gridRow.id === entry.rowId)) {
              const list = tally.rows.get(entry.rowId)
              if (list) list.push(entry.value)
              else tally.rows.set(entry.rowId, [entry.value])
            } else {
              bump(tally.unresolved, `${entry.rowId}=${entry.value}`)
            }
          }
          break
      }
    }
  }

  return tallies
}

/** A percentage of the people who answered, or blank rather than NaN. */
function percent(count: number, denominator: number): string {
  return denominator > 0 ? formatNumber((count * 100) / denominator, 1) : ''
}

/**
 * One line per question and option, with the counts.
 *
 * Note for whoever reads the file: on a multiple-choice question the
 * percentages add up to more than 100, because one person can pick several
 * options. That is not a rounding error.
 */
export function buildFrequencyCsv(rows: ResponseRow[]): string {
  const spine = buildSpine(rows)
  const tallies = tallyAll(rows, spine)

  const headers = [
    E.audience,
    E.section,
    E.question,
    E.statement,
    E.row,
    E.kind,
    E.option,
    E.answers,
    E.offered,
    E.answered,
    E.value,
    E.percent,
    E.unresolved,
  ]

  const body: Array<Array<unknown>> = []

  for (const question of spine) {
    const tally = tallies.get(question.key) ?? emptyTally()
    // Two columns, because one cannot do both jobs. `label` identifies the
    // question — a rating grid's `text` is «Valore de 1 a 5…», which names
    // nothing — and `text` is the exact wording, which is what you need to
    // interpret the numbers. The unit rides the label, so €/kg and €/pieza
    // stay distinguishable at a glance.
    const head = [
      audienceLabel(question.audience),
      question.sectionName,
      question.unit ? format(E.withUnit, { label: question.label, unit: question.unit }) : question.label,
      question.text,
    ]

    const line = (
      rowText: string,
      kind: string,
      option: string,
      count: number | '',
      offered: number | '',
      value: string,
      pct: string,
      unresolved = false,
    ) => {
      body.push([
        ...head,
        rowText,
        kind,
        option,
        count,
        offered,
        tally.answered,
        value,
        pct,
        unresolved ? E.yes : '',
      ])
    }

    switch (question.type) {
      case 'single_choice':
      case 'multi_choice': {
        const kind = question.type === 'multi_choice' ? E.kindMultiOption : E.kindOption
        for (const option of question.options) {
          const count = tally.options.get(option.id) ?? 0
          line(
            '',
            kind,
            option.text,
            count,
            option.offered,
            '',
            percent(count, tally.answered),
          )
        }
        break
      }

      case 'scale': {
        const { min, max } = question.scale ?? { min: 1, max: 5 }
        for (let point = min; point <= max; point += 1) {
          const count = tally.values.filter((value) => value === point).length
          line('', E.kindScalePoint, String(point), count, question.asked, '', percent(count, tally.answered))
        }
        if (tally.values.length > 0) {
          line('', E.kindStatistic, E.statMean, tally.values.length, question.asked, formatNumber(mean(tally.values), 2), '')
        }
        break
      }

      case 'scale_grid': {
        const { min, max } = question.scale ?? { min: 1, max: 5 }
        for (const gridRow of question.rows) {
          const values = tally.rows.get(gridRow.id) ?? []
          for (let point = min; point <= max; point += 1) {
            const count = values.filter((value) => value === point).length
            line(gridRow.text, E.kindScalePoint, String(point), count, gridRow.offered, '', percent(count, values.length))
          }
          if (values.length > 0) {
            line(gridRow.text, E.kindStatistic, E.statMean, values.length, gridRow.offered, formatNumber(mean(values), 2), '')
          }
        }
        break
      }

      case 'number': {
        const values = tally.values
        line('', E.kindStatistic, E.statCount, values.length, question.asked, '', '')
        if (values.length > 0) {
          const stats: Array<[string, number]> = [
            [E.statMean, mean(values)],
            [E.statMedian, median(values)],
            [E.statMin, Math.min(...values)],
            [E.statMax, Math.max(...values)],
          ]
          for (const [name, value] of stats) {
            line('', E.kindStatistic, name, values.length, question.asked, formatNumber(value, 2), '')
          }
        }
        break
      }

      case 'short_text':
      case 'long_text':
        line('', E.kindFreeText, '', tally.written, question.asked, '', '')
        break
    }

    // Raw ids no snapshot explains keep a line of their own. The hard rule:
    // nothing is dropped just because it stopped being recognisable.
    for (const [raw, count] of [...tally.unresolved].toSorted(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
      line('', E.kindOption, raw, count, '', '', percent(count, tally.answered), true)
    }

    // Item nonresponse, made visible rather than left as a gap between two
    // columns nobody compares.
    const missing = question.asked - tally.answered
    if (missing > 0) {
      line('', E.kindNoAnswer, '', missing, question.asked, '', percent(missing, question.asked))
    }
  }

  appendOpenAnswer(body, rows)

  return toCsv(headers, body)
}

/** The open question is an answer too; dropping it would lose data. */
function appendOpenAnswer(body: Array<Array<unknown>>, rows: ResponseRow[]): void {
  const asked = rows.filter((row) => wasAskedOpenQuestion(row.questionnaire, row.open_answer))
  if (asked.length === 0) return

  const written = asked.filter((row) => (row.open_answer ?? '').trim() !== '').length
  const audience = asked[0]!.respondent_type

  body.push([
    audienceLabel(audience),
    '',
    E.openAnswer,
    '',
    '',
    E.kindFreeText,
    '',
    written,
    asked.length,
    written,
    '',
    percent(written, asked.length),
    '',
  ])
}
