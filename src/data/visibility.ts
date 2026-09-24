import type { Answers, Question } from './types.js'

/**
 * Returns the questions currently applicable, in order.
 *
 * Single pass: a `showIf` may only reference an earlier question, so by the
 * time we evaluate a question the answer it depends on has already been seen.
 *
 * This is the SINGLE source of truth for which questions apply. It is used by
 * the step builder, the progress bar, the submission payload and the
 * server-side validator. Do not write a second implementation.
 */
export function visibleQuestions(questions: Question[], answers: Answers): Question[] {
  return questions.filter((question) => {
    const showIf = question.showIf
    if (!showIf) return true

    const answer = answers[showIf.questionId]
    if (!answer) return false
    if (answer.kind === 'option') return showIf.optionIds.includes(answer.optionId)
    if (answer.kind === 'options') return answer.optionIds.some((id) => showIf.optionIds.includes(id))
    return false
  })
}

/**
 * The answers to keep when submitting: hidden questions keep their stored
 * answer in state (so back-and-forth navigation never loses work) but are
 * excluded from the payload.
 */
export function visibleAnswers(questions: Question[], answers: Answers): Answers {
  const result: Answers = {}
  for (const question of visibleQuestions(questions, answers)) {
    const answer = answers[question.id]
    if (answer !== undefined) result[question.id] = answer
  }
  return result
}
