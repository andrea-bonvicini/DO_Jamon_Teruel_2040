import { resolveOptionText, resolveRowText, resolveSnapshot } from '../src/data/snapshot'
import type { SnapshotQuestion } from '../src/data/snapshot'
import type { AnswerValue } from '../src/data/types'
import type { ResponseRow } from './responsesRepository'
import { toCsv } from './csv'

/**
 * Both export shapes are pure functions over the rows, and both render from
 * each response's OWN snapshot — never from the current questionnaire files —
 * so a reworded question does not retroactively change historical data.
 *
 * Hard rule: no answer is ever silently dropped. When a value cannot be
 * resolved against its snapshot, the raw ids are emitted and the row is
 * marked in the `unresolved` column.
 */

const UNRESOLVED = 'unresolved'

const pad = (n: number) => String(n).padStart(2, '0')

/** ISO date and a human date in one place, so both shapes agree. */
function dates(row: ResponseRow): { iso: string; human: string } {
  const date = new Date(row.created_at)
  return {
    iso: row.created_at,
    human: `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`,
  }
}

interface RenderedAnswer {
  text: string
  raw: string
  unresolved: boolean
}

/** One answer rendered for the `wide` shape: option TEXTS, `|`-joined. */
function renderAnswer(question: SnapshotQuestion | undefined, answer: AnswerValue): RenderedAnswer {
  switch (answer.kind) {
    case 'option': {
      const text = question ? resolveOptionText(question, answer.optionId) : null
      return { text: text ?? answer.optionId, raw: answer.optionId, unresolved: text === null }
    }

    case 'options': {
      const parts = answer.optionIds.map((id) => ({
        id,
        text: question ? resolveOptionText(question, id) : null,
      }))
      return {
        text: parts.map((part) => part.text ?? part.id).join('|'),
        raw: answer.optionIds.join('|'),
        unresolved: parts.some((part) => part.text === null),
      }
    }

    case 'number':
      return { text: String(answer.value), raw: String(answer.value), unresolved: false }

    case 'text':
      return { text: answer.value, raw: answer.value, unresolved: false }

    case 'scaleRows': {
      // Only reached for the single grid column; per-row columns are emitted
      // separately by buildWideRows.
      const parts = Object.entries(answer.values).map(([rowId, rating]) => {
        const label = question ? resolveRowText(question, rowId) : null
        return { text: `${label ?? rowId}=${rating}`, unresolved: label === null }
      })
      return {
        text: parts.map((part) => part.text).join('|'),
        raw: Object.entries(answer.values)
          .map(([rowId, rating]) => `${rowId}=${rating}`)
          .join('|'),
        unresolved: parts.some((part) => part.unresolved),
      }
    }
  }
}

/**
 * Every column key the wide shape needs, in snapshot order across all rows.
 * A `scale_grid` contributes one column per row (`C-Q15_aporta-valor`), so
 * the analysis shape is identical to separate scale questions.
 */
function wideAnswerColumns(rows: ResponseRow[]): string[] {
  const columns: string[] = []
  const seen = new Set<string>()

  for (const row of rows) {
    for (const question of row.questionnaire?.questions ?? []) {
      if (question.type === 'scale_grid' && question.rows) {
        for (const gridRow of question.rows) {
          const key = `${question.id}_${gridRow.id}`
          if (!seen.has(key)) {
            seen.add(key)
            columns.push(key)
          }
        }
        continue
      }
      if (!seen.has(question.id)) {
        seen.add(question.id)
        columns.push(question.id)
      }
    }
    // An answer with no snapshot entry still gets a column rather than
    // vanishing from the export.
    for (const id of Object.keys(row.answers ?? {})) {
      if (!seen.has(id)) {
        seen.add(id)
        columns.push(id)
      }
    }
  }

  return columns
}

function identificationColumns(rows: ResponseRow[]): string[] {
  const columns: string[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    for (const key of Object.keys(row.identification ?? {})) {
      if (!seen.has(key)) {
        seen.add(key)
        columns.push(key)
      }
    }
  }
  return columns
}

/** One row per response. */
export function buildWideCsv(rows: ResponseRow[]): string {
  const idColumns = identificationColumns(rows)
  const answerColumns = wideAnswerColumns(rows)

  const headers = [
    'id',
    'date',
    'date_iso',
    'respondent_type',
    ...idColumns.map((key) => `id_${key}`),
    'questionnaire_id',
    'questionnaire_version',
    'answers_count',
    ...answerColumns,
    'open_answer',
    UNRESOLVED,
  ]

  const body = rows.map((row) => {
    const snapshot = row.questionnaire ? resolveSnapshot(row.questionnaire) : new Map()
    const answers = row.answers ?? {}
    const { iso, human } = dates(row)
    let unresolved = false

    const cells = new Map<string, string>()
    for (const [questionId, answer] of Object.entries(answers)) {
      const question = snapshot.get(questionId)

      if (answer.kind === 'scaleRows') {
        for (const [rowId, rating] of Object.entries(answer.values)) {
          if (question && resolveRowText(question, rowId) === null) unresolved = true
          if (!question) unresolved = true
          cells.set(`${questionId}_${rowId}`, String(rating))
        }
        continue
      }

      const rendered = renderAnswer(question, answer)
      if (rendered.unresolved || !question) unresolved = true
      cells.set(questionId, rendered.text)
    }

    return [
      row.id,
      human,
      iso,
      row.respondent_type,
      ...idColumns.map((key) => row.identification?.[key] ?? ''),
      row.questionnaire_id,
      row.questionnaire_version,
      Object.keys(answers).length,
      ...answerColumns.map((key) => cells.get(key) ?? ''),
      row.open_answer ?? '',
      unresolved ? 'yes' : '',
    ]
  })

  return toCsv(headers, body)
}

/** One row per answer — the shape for R, Python or a pivot table. */
export function buildLongCsv(rows: ResponseRow[]): string {
  const headers = [
    'response_id',
    'date',
    'respondent_type',
    'section_id',
    'section_name',
    'question_id',
    'question_label',
    'question_text',
    'question_type',
    'row_id',
    'row_text',
    'answer_kind',
    'answer_value',
    'answer_text',
    UNRESOLVED,
  ]

  const body: Array<Array<unknown>> = []

  for (const row of rows) {
    const snapshot = row.questionnaire ? resolveSnapshot(row.questionnaire) : new Map()
    const { human } = dates(row)

    for (const [questionId, answer] of Object.entries(row.answers ?? {})) {
      const question = snapshot.get(questionId)
      const base = [
        row.id,
        human,
        row.respondent_type,
        question?.sectionId ?? '',
        question?.sectionName ?? '',
        questionId,
        question?.label ?? '',
        question?.text ?? '',
        question?.type ?? '',
      ]

      if (answer.kind === 'scaleRows') {
        // One CSV row per matrix row.
        for (const [rowId, rating] of Object.entries(answer.values)) {
          const rowText = question ? resolveRowText(question, rowId) : null
          body.push([
            ...base,
            rowId,
            rowText ?? '',
            answer.kind,
            rating,
            String(rating),
            !question || rowText === null ? 'yes' : '',
          ])
        }
        continue
      }

      const rendered = renderAnswer(question, answer)
      body.push([
        ...base,
        '',
        '',
        answer.kind,
        rendered.raw,
        rendered.text,
        !question || rendered.unresolved ? 'yes' : '',
      ])
    }

    // The open answer is an answer too; dropping it would lose data.
    if (row.open_answer) {
      body.push([
        row.id,
        human,
        row.respondent_type,
        '',
        '',
        'open_answer',
        'Respuesta abierta',
        '',
        'long_text',
        '',
        '',
        'text',
        row.open_answer,
        row.open_answer,
        '',
      ])
    }
  }

  return toCsv(headers, body)
}
