import { createContext, useMemo, useReducer } from 'react'
import type { Dispatch, ReactNode } from 'react'
import type { AnswerValue, Answers, AudienceId, Questionnaire } from '../data/types'
import { getQuestionnaire } from '../data/questionnaires'
import { buildSteps } from './steps'
import type { Step } from './steps'

export type SubmissionStatus = 'idle' | 'sending' | 'sent' | 'error'

export interface State {
  audience: AudienceId | null
  identification: Record<string, string | number>
  privacyAccepted: boolean
  answers: Answers
  openAnswer: string
  stepIndex: number
  submission: { status: SubmissionStatus; message?: string }
}

export type Action =
  | { type: 'SET_AUDIENCE'; audience: AudienceId }
  | { type: 'SET_IDENTIFICATION_FIELD'; field: string; value: string | number }
  | { type: 'SET_PRIVACY_ACCEPTED'; accepted: boolean }
  | { type: 'SET_ANSWER'; questionId: string; value: AnswerValue | null }
  | { type: 'SET_OPEN_ANSWER'; value: string }
  | { type: 'GO_NEXT'; stepCount: number }
  | { type: 'GO_BACK' }
  | { type: 'SET_SUBMISSION'; status: SubmissionStatus; message?: string }
  | { type: 'RESET' }

export const INITIAL_STATE: State = {
  audience: null,
  identification: {},
  privacyAccepted: false,
  answers: {},
  openAnswer: '',
  stepIndex: 0,
  submission: { status: 'idle' },
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_AUDIENCE':
      // Switching audience invalidates every answer: the two questionnaires
      // share no question ids.
      return state.audience === action.audience
        ? state
        : { ...INITIAL_STATE, stepIndex: state.stepIndex, audience: action.audience }

    case 'SET_IDENTIFICATION_FIELD':
      return {
        ...state,
        identification: { ...state.identification, [action.field]: action.value },
      }

    case 'SET_PRIVACY_ACCEPTED':
      return { ...state, privacyAccepted: action.accepted }

    case 'SET_ANSWER': {
      const answers = { ...state.answers }
      if (action.value === null) delete answers[action.questionId]
      else answers[action.questionId] = action.value
      return { ...state, answers }
    }

    case 'SET_OPEN_ANSWER':
      return { ...state, openAnswer: action.value }

    case 'GO_NEXT':
      return { ...state, stepIndex: Math.min(state.stepIndex + 1, action.stepCount - 1) }

    case 'GO_BACK':
      return { ...state, stepIndex: Math.max(state.stepIndex - 1, 0) }

    case 'SET_SUBMISSION':
      return {
        ...state,
        submission: action.message
          ? { status: action.status, message: action.message }
          : { status: action.status },
      }

    case 'RESET':
      // "Nuevo cuestionario": in-memory reset, never a page reload.
      return INITIAL_STATE

    default:
      return state
  }
}

export interface QuestionnaireContextValue {
  state: State
  dispatch: Dispatch<Action>
  /** Looked up from the registry on every render, so it cannot desync. */
  questionnaire: Questionnaire | null
  steps: Step[]
  step: Step
}

export const QuestionnaireContext = createContext<QuestionnaireContextValue | null>(null)

export function QuestionnaireProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE)

  const value = useMemo<QuestionnaireContextValue>(() => {
    const questionnaire = state.audience ? getQuestionnaire(state.audience) : null
    const steps = buildSteps(questionnaire, state.answers)
    const stepIndex = Math.min(state.stepIndex, steps.length - 1)
    // `steps` always holds at least welcome + audience, so this is defined.
    const step = steps[stepIndex] as Step

    return { state, dispatch, questionnaire, steps, step }
  }, [state])

  return <QuestionnaireContext.Provider value={value}>{children}</QuestionnaireContext.Provider>
}
