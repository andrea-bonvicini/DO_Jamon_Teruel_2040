import { resolveOptionText, resolveRowText, resolveSnapshot } from '../src/data/snapshot.js'
import type { QuestionnaireSnapshot, SnapshotQuestion } from '../src/data/snapshot.js'
import { AUDIENCE_IDS } from '../src/data/types.js'
import type { AnswerValue, QuestionType } from '../src/data/types.js'
import { IDENTIFICATION } from '../src/data/identification.js'
import type { ResponseRow } from './responsesRepository.js'

/**
 * The questionnaire model behind both exports: what was asked, to whom, in
 * what order. Pure — it knows nothing about CSV.
 *
 * It exists because both shapes need the same hard part. An export pools
 * responses that may carry DIFFERENT snapshots: a question reworded between
 * versions, an option added, a conditional question that half the sample
 * never saw. Getting that wrong does not crash anything — it quietly reports
 * a percentage against the wrong denominator.
 *
 * Everything here reads from each response's own snapshot, never from the
 * current questionnaire files. The one deliberate exception is the
 * identification LABEL (see `identificationLabel`), which is structural
 * rather than questionnaire content.
 */

/** String comparison that does not depend on the host locale. */
function cmp(a: string, b: string): number {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

/**
 * The order rows are scanned in whenever the scan affects output order.
 *
 * Never the array order: `listResponsesForExport` sorts by `created_at` in a
 * direction taken from the QUERY STRING, so scanning in array order made the
 * same data produce different column orders for `?direction=asc` and `desc`.
 */
function canonical(rows: ResponseRow[]): ResponseRow[] {
  return rows.toSorted(
    (a, b) =>
      cmp(a.questionnaire?.version ?? '', b.questionnaire?.version ?? '') ||
      cmp(a.questionnaire?.capturedAt ?? '', b.questionnaire?.capturedAt ?? '') ||
      cmp(a.id, b.id),
  )
}

/** Most recent first: the snapshot whose wording the export presents. */
function byRecency(a: ResponseRow, b: ResponseRow): number {
  return (
    cmp(b.questionnaire?.capturedAt ?? '', a.questionnaire?.capturedAt ?? '') ||
    cmp(b.questionnaire?.version ?? '', a.questionnaire?.version ?? '') ||
    cmp(a.id, b.id)
  )
}

export interface SpineOption {
  id: string
  text: string
  /** Respondents whose snapshot offered THIS option, not just the question. */
  offered: number
}

export interface SpineGridRow {
  id: string
  text: string
  offered: number
}

export interface SpineQuestion {
  /** Column key. Carries the unit for `number`, so €/kg and €/pieza split. */
  key: string
  id: string
  audience: string
  label: string
  text: string
  type: QuestionType
  sectionId: string
  sectionName: string
  unit?: string
  scale?: { min: number; max: number }
  options: SpineOption[]
  rows: SpineGridRow[]
  /** Respondents whose snapshot contained this question. */
  asked: number
  /** No snapshot ever described this id; the answer is rendered raw. */
  orphan: boolean
}

/**
 * `number` is keyed by unit as well as id. €/kg and €/pieza are not the same
 * variable, and averaging them together would produce a number that means
 * nothing. Every other type is keyed by id alone, so a question that was only
 * reworded stays one column instead of forking into two half-empty ones.
 */
export function questionKey(question: SnapshotQuestion): string {
  return question.type === 'number' ? `${question.id}\u0000${question.unit ?? ''}` : question.id
}

interface Occurrence {
  row: ResponseRow
  question: SnapshotQuestion
}

/** The questions of one audience, merged across every version in the pool. */
function spineForAudience(rows: ResponseRow[]): SpineQuestion[] {
  const scan = canonical(rows)

  const occurrences = new Map<string, Occurrence[]>()
  const knownIds = new Set<string>()
  for (const row of scan) {
    for (const question of row.questionnaire?.questions ?? []) {
      knownIds.add(question.id)
      const key = questionKey(question)
      const list = occurrences.get(key)
      if (list) list.push({ row, question })
      else occurrences.set(key, [{ row, question }])
    }
  }

  // The richest snapshot leads: it is the one that saw the conditional
  // questions, and `visibleQuestions` is a filter, so it preserves the
  // questionnaire's own order. Anything it missed is appended afterwards.
  const lead = scan.reduce<ResponseRow | null>((best, row) => {
    if (!best) return row
    const a = row.questionnaire?.questions.length ?? 0
    const b = best.questionnaire?.questions.length ?? 0
    if (a !== b) return a > b ? row : best
    return byRecency(row, best) < 0 ? row : best
  }, null)

  const orderedKeys: string[] = []
  const placed = new Set<string>()
  const place = (key: string) => {
    if (placed.has(key)) return
    placed.add(key)
    orderedKeys.push(key)
  }
  for (const question of lead?.questionnaire?.questions ?? []) place(questionKey(question))
  for (const row of scan) {
    for (const question of row.questionnaire?.questions ?? []) place(questionKey(question))
  }

  const spine = orderedKeys.map((key) => merge(key, occurrences.get(key) ?? []))

  // An answer no snapshot explains still gets a place, at the end, rather
  // than disappearing from the export.
  const orphanIds = new Set<string>()
  for (const row of scan) {
    for (const id of Object.keys(row.answers ?? {})) {
      if (!knownIds.has(id)) orphanIds.add(id)
    }
  }
  const audience = scan[0]?.questionnaire_id ?? scan[0]?.respondent_type ?? ''
  for (const id of [...orphanIds].toSorted(cmp)) {
    spine.push({
      key: id,
      id,
      audience,
      label: id,
      text: id,
      type: 'short_text',
      sectionId: '',
      sectionName: '',
      options: [],
      rows: [],
      asked: 0,
      orphan: true,
    })
  }

  return spine
}

/** One question, reconciled across every snapshot that carried it. */
function merge(key: string, occurrences: Occurrence[]): SpineQuestion {
  // Newest wording first, then anything only older versions offered. A
  // removed option keeps its line instead of vanishing with its answers.
  const recent = occurrences.toSorted((a, b) => byRecency(a.row, b.row))
  const newest = recent[0]!.question

  const options: SpineOption[] = []
  const seenOptions = new Map<string, SpineOption>()
  for (const { question } of recent) {
    for (const option of question.options ?? []) {
      if (seenOptions.has(option.id)) continue
      const entry: SpineOption = { id: option.id, text: option.text, offered: 0 }
      seenOptions.set(option.id, entry)
      options.push(entry)
    }
  }

  const rows: SpineGridRow[] = []
  const seenRows = new Map<string, SpineGridRow>()
  for (const { question } of recent) {
    for (const gridRow of question.rows ?? []) {
      if (seenRows.has(gridRow.id)) continue
      const entry: SpineGridRow = { id: gridRow.id, text: gridRow.text, offered: 0 }
      seenRows.set(gridRow.id, entry)
      rows.push(entry)
    }
  }

  // Offered is counted per option and per grid row, not per question: an
  // option added in a later version was only ever shown to part of the
  // sample, and dividing it by the whole pool would sink it.
  let scale: { min: number; max: number } | undefined
  for (const { question } of occurrences) {
    for (const option of question.options ?? []) seenOptions.get(option.id)!.offered += 1
    for (const gridRow of question.rows ?? []) seenRows.get(gridRow.id)!.offered += 1
    if (question.scale) {
      scale = scale
        ? { min: Math.min(scale.min, question.scale.min), max: Math.max(scale.max, question.scale.max) }
        : { min: question.scale.min, max: question.scale.max }
    }
  }

  return {
    key,
    id: newest.id,
    audience: occurrences[0]!.row.questionnaire_id,
    label: newest.label,
    text: newest.text,
    type: newest.type,
    sectionId: newest.sectionId,
    sectionName: newest.sectionName,
    ...(newest.unit ? { unit: newest.unit } : {}),
    ...(scale ? { scale } : {}),
    options,
    rows,
    asked: occurrences.length,
    orphan: false,
  }
}

/**
 * Every question in the pool, grouped by questionnaire so a mixed export
 * keeps each one's columns together, in a constant audience order.
 */
export function buildSpine(rows: ResponseRow[]): SpineQuestion[] {
  const groups = new Map<string, ResponseRow[]>()
  for (const row of rows) {
    const audience = row.questionnaire_id ?? row.respondent_type
    const list = groups.get(audience)
    if (list) list.push(row)
    else groups.set(audience, [row])
  }

  const known = AUDIENCE_IDS.filter((id) => groups.has(id))
  const unknown = [...groups.keys()].filter((id) => !AUDIENCE_IDS.includes(id as never)).toSorted(cmp)

  return [...known, ...unknown].flatMap((audience) => spineForAudience(groups.get(audience) ?? []))
}

/** The snapshot question one row actually saw, or undefined. */
export function questionOf(row: ResponseRow, id: string): SnapshotQuestion | undefined {
  return row.questionnaire ? resolveSnapshot(row.questionnaire).get(id) : undefined
}

/** Whether this row was asked the open question at the end. */
export function wasAskedOpenQuestion(snapshot: QuestionnaireSnapshot | undefined, openAnswer: string | null): boolean {
  // Rows written before the snapshot carried the open question fall back to
  // the answer itself: having written one is proof of having been asked.
  return snapshot?.openQuestion !== undefined || openAnswer !== null
}

const pad = (n: number) => String(n).padStart(2, '0')

/** ISO date and a human date in one place, so both shapes agree. */
export function dates(row: ResponseRow): { iso: string; human: string } {
  const date = new Date(row.created_at)
  return {
    iso: row.created_at,
    human: `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`,
  }
}

/**
 * A decimal comma, always.
 *
 * `String(18.5)` is `'18.5'`, which Excel in a Spanish locale reads as TEXT,
 * not as a number — and a price column that is text is a column nobody can
 * average. `escapeCsvField` never quotes commas, so the bare field is safe.
 */
export function formatNumber(value: number, decimals?: number): string {
  if (!Number.isFinite(value)) return ''
  const fixed = decimals === undefined ? String(value) : value.toFixed(decimals)
  return fixed.replace('.', ',')
}

export function mean(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length
}

/** Even-sized sets take the mean of the two middle values. */
export function median(values: number[]): number {
  const sorted = values.toSorted((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!
}

/**
 * One grid answer, flattened to its rows. The single place that resolves a
 * grid row's text — it used to be four copies, each repeating the same null
 * check, which is how they drift apart.
 */
export function scaleRowEntries(
  question: SnapshotQuestion | undefined,
  answer: Extract<AnswerValue, { kind: 'scaleRows' }>,
): Array<{ rowId: string; text: string | null; value: number }> {
  return Object.entries(answer.values).map(([rowId, value]) => ({
    rowId,
    text: question ? resolveRowText(question, rowId) : null,
    value,
  }))
}

/** Chosen option ids resolved to their stored texts, raw id when they cannot be. */
export function renderChoiceTexts(
  question: SnapshotQuestion | undefined,
  ids: string[],
): { texts: string[]; unresolved: boolean } {
  const parts = ids.map((id) => (question ? resolveOptionText(question, id) : null))
  return {
    texts: parts.map((text, index) => text ?? ids[index]!),
    unresolved: parts.some((text) => text === null),
  }
}

/** Identification keys across the pool, in first-seen order. */
export function identificationColumns(rows: ResponseRow[]): string[] {
  const columns: string[] = []
  const seen = new Set<string>()
  for (const row of canonical(rows)) {
    for (const key of Object.keys(row.identification ?? {})) {
      if (!seen.has(key)) {
        seen.add(key)
        columns.push(key)
      }
    }
  }
  return columns
}

/**
 * The human label of an identification field.
 *
 * DELIBERATE EXCEPTION to "never read the current data files": identification
 * fields are structural, not questionnaire content, and the snapshot does not
 * carry their labels. `companyName` as a column header is worse than this
 * small inconsistency. If the label is ever changed, old exports change with
 * it — which is acceptable for a header and would not be for an answer.
 */
export function identificationLabel(key: string): string {
  for (const audience of AUDIENCE_IDS) {
    const field = IDENTIFICATION[audience].find((entry) => entry.id === key)
    if (field) return field.label
  }
  return key
}
