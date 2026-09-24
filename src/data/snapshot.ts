import type { AudienceId, Answers, Questionnaire, QuestionType } from './types.js'
import { visibleQuestions } from './visibility.js'

/**
 * The exact questions and option texts that were shown to one respondent.
 *
 * Stored alongside the answers so that every row stays self-describing
 * forever: the day a question is reworded or its options reordered,
 * `"C-Q16": "clima"` still resolves to the text that respondent actually read.
 * The admin detail view and both CSV exports render from this, never from the
 * current questionnaire files.
 */
export interface SnapshotQuestion {
  id: string
  label: string
  text: string
  type: QuestionType
  sectionId: string
  sectionName: string
  options?: Array<{ id: string; text: string }>
  /** Present only for `scale_grid`. */
  rows?: Array<{ id: string; text: string }>
  /** Present for `scale` and `scale_grid`. */
  scale?: { min: number; max: number; minLabel?: string; maxLabel?: string }
  /**
   * Present for `number`. Without it a stored 9 is ambiguous when a human
   * reads the response back: 9 euros, 9 kilos, 9 years?
   */
  unit?: string
  /**
   * The frequency export breaks its results down by this question. Stored
   * per response so an old row still knows how it was meant to be crossed,
   * the same way it already knows what its options said.
   */
  segment?: boolean
}

export interface QuestionnaireSnapshot {
  questionnaireId: AudienceId
  version: string
  capturedAt: string // ISO timestamp
  questions: SnapshotQuestion[]
  /**
   * Present only when the questionnaire ended with an open question. Without
   * it a stored `open_answer: null` cannot be told apart from "was never
   * asked" — only the company questionnaire has one — and the export would
   * divide the open answers by the whole sample. Optional, so rows written
   * before this field existed still parse; the export falls back to treating
   * a non-null `open_answer` as proof the question was asked.
   */
  openQuestion?: { text: string }
}

/** Built from the VISIBLE questions only, at submission time. */
export function buildSnapshot(
  questionnaire: Questionnaire,
  answers: Answers,
  capturedAt: string = new Date().toISOString(),
): QuestionnaireSnapshot {
  const sectionNames = new Map(questionnaire.sections.map((s) => [s.id, s.name]))

  return {
    questionnaireId: questionnaire.id,
    version: questionnaire.version,
    capturedAt,
    ...(questionnaire.openQuestion ? { openQuestion: { text: questionnaire.openQuestion.text } } : {}),
    questions: visibleQuestions(questionnaire.questions, answers).map((question) => {
      const entry: SnapshotQuestion = {
        id: question.id,
        label: question.label,
        text: question.text,
        type: question.type,
        sectionId: question.sectionId,
        sectionName: sectionNames.get(question.sectionId) ?? question.sectionId,
      }

      if (question.type === 'single_choice' || question.type === 'multi_choice') {
        entry.options = question.options.map((o) => ({ id: o.id, text: o.text }))
      }

      if (question.type === 'scale_grid') {
        entry.rows = question.rows.map((r) => ({ id: r.id, text: r.text }))
      }

      if (question.type === 'number' && question.unit) {
        entry.unit = question.unit
      }

      // Only ever on single choice: with multiple choice the same respondent
      // would fall into several groups and be counted several times.
      if (question.segment && question.type === 'single_choice') {
        entry.segment = true
      }

      if (question.type === 'scale' || question.type === 'scale_grid') {
        entry.scale = {
          min: question.min,
          max: question.max,
          ...(question.minLabel ? { minLabel: question.minLabel } : {}),
          ...(question.maxLabel ? { maxLabel: question.maxLabel } : {}),
        }
      }

      return entry
    }),
  }
}

/** Index a snapshot by question id, for the admin view and the exports. */
export function resolveSnapshot(
  snapshot: QuestionnaireSnapshot,
): Map<string, SnapshotQuestion> {
  return new Map(snapshot.questions.map((question) => [question.id, question]))
}

/** The stored text of one option id, or null when the snapshot cannot resolve it. */
export function resolveOptionText(question: SnapshotQuestion, optionId: string): string | null {
  return question.options?.find((option) => option.id === optionId)?.text ?? null
}

/** The stored text of one grid row id, or null when the snapshot cannot resolve it. */
export function resolveRowText(question: SnapshotQuestion, rowId: string): string | null {
  return question.rows?.find((row) => row.id === rowId)?.text ?? null
}
