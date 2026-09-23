import type { Answers, Question, Questionnaire } from '../data/types'
import { visibleQuestions } from '../data/visibility'

export type Step =
  | { type: 'welcome' }
  | { type: 'audience' }
  | { type: 'identification' }
  | { type: 'question'; question: Question; index: number; total: number }
  | { type: 'open-answer' }
  | { type: 'thank-you' }

/**
 * The step list is DERIVED, never stored. It is recomputed on every render
 * from the current audience and answers, so the flow grows and shrinks live
 * as conditionals flip.
 *
 * Because a `showIf` can only depend on an EARLIER question, answering the
 * current question can only change steps that come after it — so the current
 * `stepIndex` always stays valid.
 *
 * The progress denominator is `visible.length`, never
 * `questionnaire.questions.length`: the unfiltered count would be wrong the
 * moment a conditional hides something.
 */
export function buildSteps(questionnaire: Questionnaire | null, answers: Answers): Step[] {
  const steps: Step[] = [{ type: 'welcome' }, { type: 'audience' }]
  if (!questionnaire) return steps

  steps.push({ type: 'identification' })

  const visible = visibleQuestions(questionnaire.questions, answers)
  visible.forEach((question, i) => {
    steps.push({ type: 'question', question, index: i + 1, total: visible.length })
  })

  if (questionnaire.openQuestion) steps.push({ type: 'open-answer' })
  steps.push({ type: 'thank-you' })

  return steps
}
