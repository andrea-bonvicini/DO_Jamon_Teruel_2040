// ─── Audiences ──────────────────────────────────────────────────────────────
export type AudienceId = 'company' | 'individual'

export const AUDIENCE_IDS: readonly AudienceId[] = ['company', 'individual']

export function isAudienceId(value: unknown): value is AudienceId {
  return value === 'company' || value === 'individual'
}

// ─── Question types ─────────────────────────────────────────────────────────
export type QuestionType =
  | 'single_choice' // pick exactly one option
  | 'multi_choice' // pick one or more options
  | 'scale' // integer on a labelled range, e.g. 1–5
  | 'scale_grid' // several rows sharing one labelled range — see DECISIONS.md
  | 'short_text' // one-line free text
  | 'long_text' // multi-line free text
  | 'number' // numeric value

/**
 * Icon ids are drawn in `src/components/Icon.tsx`. Naming one here keeps the
 * choice of illustration in the data, so a question can gain or change an
 * icon without touching a component (CLAUDE.md rule 4). An unknown or absent
 * id simply renders no icon.
 */
export type OptionIcon =
  | 'ganaderia'
  | 'matadero'
  | 'secadero'
  | 'mixta'
  | 'otra'

export interface Option {
  id: string // stable, short, unique within the question
  text: string // what the respondent reads
  icon?: OptionIcon // presentation only; never stored, never exported
}

/** One rated row of a `scale_grid` question. */
export interface ScaleRow {
  id: string // stable, short, unique within the question
  text: string
}

// ─── Conditional visibility ─────────────────────────────────────────────────
// The question is shown only if the referenced question was answered with one
// of the listed option ids.
// INVARIANT: `questionId` MUST refer to a question that appears EARLIER in the
// array. Enforced by tests/data/consistency.test.ts.
export interface ShowIf {
  questionId: string
  optionIds: string[]
}

// ─── Question ───────────────────────────────────────────────────────────────
interface QuestionBase {
  id: string // globally unique within its questionnaire, e.g. 'C-Q01'
  sectionId: string // must exist in the questionnaire's sections
  label: string // short label for the admin list and CSV headers
  text: string // the question as the respondent reads it
  help?: string // optional clarifying sentence shown under the question
  required: boolean // if false, the respondent may press Next without answering
  showIf?: ShowIf
  /**
   * Marks this question as one the frequency export breaks the results down
   * by — «of the mataderos, how many said X». It describes WHO is answering
   * rather than what they think, so it only ever goes on `single_choice`:
   * with multiple choice the same person would land in several groups at
   * once and be counted several times.
   *
   * It lives here, in the data, so the cuts can be changed without touching
   * a line of code. Two things to weigh before adding one: a question with
   * many options multiplies the file by that many and leaves most cells with
   * two or three people in them, and a group small enough to identify
   * somebody must not be published — see DECISIONS.md.
   */
  segment?: boolean
}

export interface SingleChoiceQuestion extends QuestionBase {
  type: 'single_choice'
  options: Option[]
  /**
   * Presentation only — see DECISIONS.md. 'select' is for long closed lists
   * (e.g. the 19 comunidades autónomas) that would otherwise fill the screen
   * with radio cards. Storage, validation and export are identical either way.
   */
  display?: 'radio' | 'select'
}

export interface MultiChoiceQuestion extends QuestionBase {
  type: 'multi_choice'
  options: Option[]
  minSelections?: number
  maxSelections?: number
}

export interface ScaleQuestion extends QuestionBase {
  type: 'scale'
  min: number
  max: number
  minLabel?: string
  maxLabel?: string
}

export interface ScaleGridQuestion extends QuestionBase {
  type: 'scale_grid'
  rows: ScaleRow[]
  min: number
  max: number
  minLabel?: string
  maxLabel?: string
}

export interface ShortTextQuestion extends QuestionBase {
  type: 'short_text'
  maxLength?: number // default 200
  placeholder?: string
}

export interface LongTextQuestion extends QuestionBase {
  type: 'long_text'
  maxLength?: number // default 2000
  placeholder?: string
}

export interface NumberQuestion extends QuestionBase {
  type: 'number'
  min?: number
  max?: number
  unit?: string // rendered as a suffix, e.g. "€/kg"
}

export type Question =
  | SingleChoiceQuestion
  | MultiChoiceQuestion
  | ScaleQuestion
  | ScaleGridQuestion
  | ShortTextQuestion
  | LongTextQuestion
  | NumberQuestion

/** Questions that carry an `options` array. */
export type ChoiceQuestion = SingleChoiceQuestion | MultiChoiceQuestion

export function hasOptions(question: Question): question is ChoiceQuestion {
  return question.type === 'single_choice' || question.type === 'multi_choice'
}

export const DEFAULT_SHORT_TEXT_MAX = 200
export const DEFAULT_LONG_TEXT_MAX = 2000

// ─── Sections ───────────────────────────────────────────────────────────────
// Sections group questions for the admin detail view and the CSV. They do NOT
// create extra screens; the flow stays one question per screen.
export interface Section {
  id: string
  order: number
  name: string
  description?: string
}

// ─── Questionnaire ──────────────────────────────────────────────────────────
export interface Questionnaire {
  id: AudienceId
  name: string
  description: string
  estimatedDuration: string
  version: string // 'company@1.0.0' — BUMP ON EVERY CONTENT CHANGE
  sections: Section[]
  questions: Question[] // ORDER IN THIS ARRAY IS THE ORDER ON SCREEN
  openQuestion?: {
    text: string
    placeholder?: string
    maxLength: number
  }
}

// ─── Answers ────────────────────────────────────────────────────────────────
export type AnswerValue =
  | { kind: 'option'; optionId: string } // single_choice
  | { kind: 'options'; optionIds: string[] } // multi_choice
  | { kind: 'number'; value: number } // scale, number
  | { kind: 'text'; value: string } // short_text, long_text
  | { kind: 'scaleRows'; values: Record<string, number> } // scale_grid

export type Answers = Record<string, AnswerValue>

/** The answer kind each question type stores. One place, used by the validator. */
export const ANSWER_KIND_FOR_TYPE: Record<QuestionType, AnswerValue['kind']> = {
  single_choice: 'option',
  multi_choice: 'options',
  scale: 'number',
  scale_grid: 'scaleRows',
  short_text: 'text',
  long_text: 'text',
  number: 'number',
}
