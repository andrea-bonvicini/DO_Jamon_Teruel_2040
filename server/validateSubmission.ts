import { getQuestionnaire } from '../src/data/questionnaires'
import { IDENTIFICATION } from '../src/data/identification'
import { visibleQuestions } from '../src/data/visibility'
import {
  DEFAULT_LONG_TEXT_MAX,
  DEFAULT_SHORT_TEXT_MAX,
  isAudienceId,
  type AnswerValue,
  type Answers,
  type AudienceId,
  type Question,
} from '../src/data/types'
import { buildSnapshot } from '../src/data/snapshot'
import type { QuestionnaireSnapshot } from '../src/data/snapshot'

export interface ValidSubmission {
  audience: AudienceId
  questionnaireId: AudienceId
  questionnaireVersion: string
  identification: Record<string, string | number>
  answers: Answers
  openAnswer: string | null
  snapshot: QuestionnaireSnapshot
}

export type ValidationResult =
  | { ok: true; value: ValidSubmission }
  | { ok: false; error: string }

const MAX_OPEN_ANSWER = 2000

/**
 * The security core. The server never trusts the client's idea of what the
 * questionnaire is: it loads the questionnaire for the declared audience from
 * the same `src/data/` modules the browser used and re-derives everything.
 *
 * This function — not the client, and not the rate limiter — is the real
 * defence.
 */
export function validateSubmission(input: unknown): ValidationResult {
  if (!isRecord(input)) return fail('Payload must be an object.')

  // 1. The audience must be one of the two known ids.
  const audience = input.audience
  if (!isAudienceId(audience)) return fail('Unknown audience.')
  if (input.questionnaireId !== audience) {
    return fail('questionnaireId does not match audience.')
  }

  const questionnaire = getQuestionnaire(audience)
  if (input.questionnaireVersion !== questionnaire.version) {
    return fail('Unknown questionnaire version.')
  }

  // 2. Identification: required fields present, typed, within limits; select
  //    values must be declared option ids; unknown keys are rejected.
  const identificationResult = validateIdentification(audience, input.identification)
  if (!identificationResult.ok) return identificationResult

  // 3. The visible set is recomputed server-side. The answered ids must equal
  //    the visible required ids, plus optionally any visible optional ones.
  const answers = input.answers
  if (!isRecord(answers)) return fail('answers must be an object.')

  const visible = visibleQuestions(questionnaire.questions, answers as Answers)
  const visibleById = new Map(visible.map((question) => [question.id, question]))

  for (const id of Object.keys(answers)) {
    if (!visibleById.has(id)) {
      return fail(`Answer for a question that does not apply: ${id}.`)
    }
  }

  for (const question of visible) {
    const answer = answers[question.id]
    if (answer === undefined) {
      if (question.required) return fail(`Missing required answer: ${question.id}.`)
      continue
    }

    // 4. Each answer's kind matches its question's type and its value is legal.
    const error = validateAnswer(question, answer)
    if (error) return fail(error)
  }

  // 5. The open answer is optional and capped.
  const openAnswerResult = validateOpenAnswer(input.openAnswer, questionnaire.openQuestion)
  if (!openAnswerResult.ok) return openAnswerResult

  return {
    ok: true,
    value: {
      audience,
      questionnaireId: audience,
      questionnaireVersion: questionnaire.version,
      identification: identificationResult.value,
      answers: answers as Answers,
      openAnswer: openAnswerResult.value,
      // Rebuilt server-side rather than trusting the client's copy, so the
      // stored wording is always the wording this deploy actually serves.
      snapshot: buildSnapshot(questionnaire, answers as Answers),
    },
  }
}

function validateIdentification(
  audience: AudienceId,
  raw: unknown,
): { ok: true; value: Record<string, string | number> } | { ok: false; error: string } {
  if (raw === undefined || raw === null) return { ok: true, value: {} }
  if (!isRecord(raw)) return fail('identification must be an object.')

  const fields = IDENTIFICATION[audience]
  const byId = new Map(fields.map((field) => [field.id, field]))
  const value: Record<string, string | number> = {}

  for (const [key, entry] of Object.entries(raw)) {
    const field = byId.get(key)
    if (!field) return fail(`Unknown identification field: ${key}.`)

    if (field.type === 'number') {
      const parsed = typeof entry === 'number' ? entry : Number(entry)
      if (!Number.isFinite(parsed)) return fail(`Identification field is not a number: ${key}.`)
      value[key] = parsed
      continue
    }

    if (typeof entry !== 'string') return fail(`Identification field must be text: ${key}.`)
    if (entry.length > (field.maxLength ?? 200)) return fail(`Identification field too long: ${key}.`)
    if (field.type === 'select' && !field.options?.some((option) => option.id === entry)) {
      return fail(`Unknown option for identification field: ${key}.`)
    }
    value[key] = entry
  }

  for (const field of fields) {
    if (!field.required) continue
    const entry = value[field.id]
    if (entry === undefined || (typeof entry === 'string' && entry.trim() === '')) {
      return fail(`Missing required identification field: ${field.id}.`)
    }
  }

  return { ok: true, value }
}

function validateOpenAnswer(
  raw: unknown,
  openQuestion: { maxLength: number } | undefined,
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (raw === undefined || raw === null || raw === '') return { ok: true, value: null }
  if (typeof raw !== 'string') return fail('openAnswer must be text.')
  if (!openQuestion) return fail('This questionnaire has no open question.')

  const max = Math.min(openQuestion.maxLength, MAX_OPEN_ANSWER)
  if (raw.length > max) return fail(`openAnswer exceeds ${max} characters.`)

  return { ok: true, value: raw }
}

/** Returns an error message, or null when the answer is legal. */
function validateAnswer(question: Question, answer: unknown): string | null {
  if (!isRecord(answer) || typeof answer.kind !== 'string') {
    return `Malformed answer: ${question.id}.`
  }
  const value = answer as unknown as AnswerValue

  switch (question.type) {
    case 'single_choice': {
      if (value.kind !== 'option') return `Wrong answer kind for ${question.id}.`
      if (typeof value.optionId !== 'string') return `Wrong answer kind for ${question.id}.`
      if (!question.options.some((option) => option.id === value.optionId)) {
        return `Unknown option for ${question.id}: ${value.optionId}.`
      }
      return null
    }

    case 'multi_choice': {
      if (value.kind !== 'options' || !Array.isArray(value.optionIds)) {
        return `Wrong answer kind for ${question.id}.`
      }
      if (new Set(value.optionIds).size !== value.optionIds.length) {
        return `Duplicate options for ${question.id}.`
      }
      for (const optionId of value.optionIds) {
        if (!question.options.some((option) => option.id === optionId)) {
          return `Unknown option for ${question.id}: ${String(optionId)}.`
        }
      }
      const min = question.minSelections ?? (question.required ? 1 : 0)
      const max = question.maxSelections ?? question.options.length
      if (value.optionIds.length < min) return `Too few options for ${question.id}.`
      if (value.optionIds.length > max) return `Too many options for ${question.id}.`
      return null
    }

    case 'scale': {
      if (value.kind !== 'number' || !Number.isInteger(value.value)) {
        return `Wrong answer kind for ${question.id}.`
      }
      if (value.value < question.min || value.value > question.max) {
        return `Value out of range for ${question.id}.`
      }
      return null
    }

    case 'scale_grid': {
      if (value.kind !== 'scaleRows' || !isRecord(value.values)) {
        return `Wrong answer kind for ${question.id}.`
      }
      const rowIds = new Set(question.rows.map((row) => row.id))
      for (const rowId of Object.keys(value.values)) {
        if (!rowIds.has(rowId)) return `Unknown row for ${question.id}: ${rowId}.`
      }
      for (const row of question.rows) {
        const rating = value.values[row.id]
        if (rating === undefined) {
          if (question.required) return `Missing row for ${question.id}: ${row.id}.`
          continue
        }
        if (!Number.isInteger(rating) || rating < question.min || rating > question.max) {
          return `Value out of range for ${question.id}/${row.id}.`
        }
      }
      return null
    }

    case 'short_text':
    case 'long_text': {
      if (value.kind !== 'text' || typeof value.value !== 'string') {
        return `Wrong answer kind for ${question.id}.`
      }
      const max =
        question.maxLength ??
        (question.type === 'short_text' ? DEFAULT_SHORT_TEXT_MAX : DEFAULT_LONG_TEXT_MAX)
      if (value.value.length > max) return `Text too long for ${question.id}.`
      if (question.required && value.value.trim() === '') {
        return `Missing required answer: ${question.id}.`
      }
      return null
    }

    case 'number': {
      if (value.kind !== 'number' || typeof value.value !== 'number' || !Number.isFinite(value.value)) {
        return `Wrong answer kind for ${question.id}.`
      }
      if (question.min !== undefined && value.value < question.min) {
        return `Value out of range for ${question.id}.`
      }
      if (question.max !== undefined && value.value > question.max) {
        return `Value out of range for ${question.id}.`
      }
      return null
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error }
}
