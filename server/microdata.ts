import { resolveSnapshot } from '../src/data/snapshot.js'
import type { SnapshotQuestion } from '../src/data/snapshot.js'
import {
  MISSING,
  NOT_SHOWN,
  OPEN_ANSWER_CODE,
  optionCode,
  selectedCountCode,
} from '../src/data/codes.js'
import type { ResponseRow } from './responsesRepository.js'
import { MACHINE, toCsv } from './csv.js'
import { buildSpine, wasAskedOpenQuestion } from './exportModel.js'
import type { SpineQuestion } from './exportModel.js'

/**
 * The microdata: one line per respondent, one column per answerable thing,
 * named by its immutable code.
 *
 * This is the file every other output is derived from, and the only one that
 * keeps one person's answers associated with each other — which is what makes
 * a cross-tabulation possible at all. It is written in the MACHINE profile
 * (RFC 4180, `,` separator, `.` decimal, no BOM) because it is loaded by R,
 * Python or Stata, not opened by hand.
 *
 * Three facts that a blank cell used to conflate are kept apart here, as
 * negative sentinels: -97 never shown, -98 declined, -99 asked and unanswered.
 * See `src/data/codes.ts` for why sentinels and not blanks.
 *
 * No identification field is exported. The company name identifies the
 * respondent by definition, and this file is the one that leaves the building;
 * `respuestas-<público>.csv` keeps the name for the Consejo's own census work,
 * and `respondent_id` joins the two.
 */

/** Only complete submissions are ever stored, so far. */
const COMPLETE = 'complete'

type ColumnKind =
  | 'single'
  | 'multiOption'
  | 'selectedCount'
  | 'numeric'
  | 'item'
  | 'textFlag'

export interface MicroColumn {
  code: string
  kind: ColumnKind
  question: SpineQuestion
  /** For `multiOption`. */
  optionId?: string
  /** For `item`. */
  rowId?: string
}

const META_COLUMNS = [
  'respondent_id',
  'wave',
  'audience',
  'questionnaire_version',
  'submitted_at',
  'started_at',
  'duration_seconds',
  'completion_status',
]

/**
 * A question's column name is its id — except when the same id appears with
 * two different units, which means two incommensurable variables that must
 * not share a column.
 */
function codeFor(question: SpineQuestion, duplicated: Set<string>): string {
  return duplicated.has(question.id) && question.unit
    ? `${question.id}_${question.unit.replace(/[^\w]+/g, '_')}`
    : question.id
}

export function microdataColumns(spine: SpineQuestion[]): MicroColumn[] {
  const counts = new Map<string, number>()
  for (const question of spine) counts.set(question.id, (counts.get(question.id) ?? 0) + 1)
  const duplicated = new Set([...counts].filter(([, n]) => n > 1).map(([id]) => id))

  const columns: MicroColumn[] = []

  for (const question of spine) {
    const code = codeFor(question, duplicated)

    switch (question.type) {
      case 'single_choice':
        columns.push({ code, kind: 'single', question })
        break

      case 'multi_choice':
        // One binary column per option, so every option is countable on its
        // own, plus how many were ticked — which is the thing a pipe-joined
        // cell makes you compute by splitting strings.
        for (const option of question.options) {
          columns.push({
            code: optionCode(code, option.id),
            kind: 'multiOption',
            question,
            optionId: option.id,
          })
        }
        columns.push({ code: selectedCountCode(code), kind: 'selectedCount', question })
        break

      case 'scale_grid':
        for (const row of question.rows) {
          columns.push({ code: optionCode(code, row.id), kind: 'item', question, rowId: row.id })
        }
        break

      case 'scale':
      case 'number':
        columns.push({ code, kind: 'numeric', question })
        break

      case 'short_text':
      case 'long_text':
        // The words live in the open-text file; here we keep whether there
        // are any, so the per-question base still adds up.
        columns.push({ code, kind: 'textFlag', question })
        break
    }
  }

  return columns
}

/** What one respondent saw, and what they did with it. */
function cellsFor(row: ResponseRow, columns: MicroColumn[]): Map<string, string | number> {
  const snapshot = row.questionnaire ? resolveSnapshot(row.questionnaire) : new Map()
  const answers = row.answers ?? {}
  const cells = new Map<string, string | number>()

  for (const column of columns) {
    const shown: SnapshotQuestion | undefined = snapshot.get(column.question.id)
    if (!shown) {
      cells.set(column.code, NOT_SHOWN)
      continue
    }

    const answer = answers[column.question.id]

    switch (column.kind) {
      case 'single':
        cells.set(column.code, answer?.kind === 'option' ? answer.optionId : MISSING)
        break

      case 'multiOption': {
        // An option a later version added was never offered to this person;
        // that is «not shown», not «did not tick it».
        const offered = (shown.options ?? []).some((option) => option.id === column.optionId)
        if (!offered) cells.set(column.code, NOT_SHOWN)
        else if (answer?.kind !== 'options') cells.set(column.code, MISSING)
        else cells.set(column.code, answer.optionIds.includes(column.optionId!) ? 1 : 0)
        break
      }

      case 'selectedCount':
        cells.set(column.code, answer?.kind === 'options' ? answer.optionIds.length : MISSING)
        break

      case 'numeric':
        cells.set(column.code, answer?.kind === 'number' ? answer.value : MISSING)
        break

      case 'item': {
        const offered = (shown.rows ?? []).some((gridRow) => gridRow.id === column.rowId)
        const rating = answer?.kind === 'scaleRows' ? answer.values[column.rowId!] : undefined
        if (!offered) cells.set(column.code, NOT_SHOWN)
        else cells.set(column.code, rating ?? MISSING)
        break
      }

      case 'textFlag':
        // 1 wrote something, 0 was asked and left it blank. There is no
        // «missing» here: an empty optional box IS the answer.
        cells.set(column.code, answer?.kind === 'text' && answer.value.trim() !== '' ? 1 : 0)
        break
    }
  }

  return cells
}

function durationSeconds(row: ResponseRow): number | '' {
  if (!row.started_at) return ''
  const seconds = (Date.parse(row.created_at) - Date.parse(row.started_at)) / 1000
  return Number.isFinite(seconds) && seconds >= 0 ? Math.round(seconds) : ''
}

export function buildMicrodataCsv(rows: ResponseRow[]): string {
  const spine = buildSpine(rows)
  const columns = microdataColumns(spine)
  const askedOpen = rows.some((row) => wasAskedOpenQuestion(row.questionnaire, row.open_answer))

  const headers = [
    ...META_COLUMNS,
    ...columns.map((column) => column.code),
    ...(askedOpen ? [OPEN_ANSWER_CODE] : []),
  ]

  const body = rows.map((row) => {
    const cells = cellsFor(row, columns)
    const wroteOpen = (row.open_answer ?? '').trim() !== ''

    return [
      row.id,
      row.wave ?? '',
      row.respondent_type,
      row.questionnaire_version,
      row.created_at,
      row.started_at ?? '',
      durationSeconds(row),
      row.completion_status ?? COMPLETE,
      ...columns.map((column) => cells.get(column.code) ?? MISSING),
      ...(askedOpen
        ? [wasAskedOpenQuestion(row.questionnaire, row.open_answer) ? (wroteOpen ? 1 : 0) : NOT_SHOWN]
        : []),
    ]
  })

  return toCsv(headers, body, MACHINE)
}

/**
 * Every verbatim, one line per (respondent, question), so a long text with
 * line breaks in it cannot widen the microdata or break its grid.
 */
export function buildOpenTextCsv(rows: ResponseRow[]): string {
  const headers = ['respondent_id', 'question_code', 'text']
  const body: Array<Array<unknown>> = []

  for (const row of rows) {
    const snapshot = row.questionnaire ? resolveSnapshot(row.questionnaire) : new Map()

    for (const [id, answer] of Object.entries(row.answers ?? {})) {
      if (answer.kind !== 'text' || answer.value.trim() === '') continue
      const question: SnapshotQuestion | undefined = snapshot.get(id)
      if (question && question.type !== 'short_text' && question.type !== 'long_text') continue
      body.push([row.id, id, answer.value])
    }

    if ((row.open_answer ?? '').trim() !== '') {
      body.push([row.id, OPEN_ANSWER_CODE, row.open_answer])
    }
  }

  return toCsv(headers, body, MACHINE)
}
