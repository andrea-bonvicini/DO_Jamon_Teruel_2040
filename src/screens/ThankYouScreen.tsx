import { useEffect, useRef } from 'react'
import { Button } from '../components/Button'
import { Screen } from '../components/Screen'
import { StatusMessage } from '../components/StatusMessage'
import { buildSnapshot } from '../data/snapshot'
import { STRINGS } from '../data/strings'
import { visibleAnswers } from '../data/visibility'
import { submitResponse } from '../network/submitResponse'
import type { SubmissionPayload } from '../network/submitResponse'
import { useQuestionnaire } from '../state/useQuestionnaire'

/**
 * Submission is NOT fire-and-forget. The respondent sees no result, so there
 * is nothing to fall back on if the POST fails:
 *   sending → sent   shows "sus respuestas han quedado registradas"
 *   sending → error  shows the message, a Retry, and keeps the state intact
 * A thank-you message is never shown for a submission that did not reach the
 * database.
 */
export function ThankYouScreen() {
  const { state, dispatch, questionnaire } = useQuestionnaire()
  // Guards against React StrictMode's double effect invocation in dev.
  const inFlight = useRef(false)

  const status = state.submission.status

  useEffect(() => {
    if (!questionnaire) return
    if (status !== 'idle') return
    if (inFlight.current) return

    inFlight.current = true
    dispatch({ type: 'SET_SUBMISSION', status: 'sending' })

    const answers = visibleAnswers(questionnaire.questions, state.answers)
    const payload: SubmissionPayload = {
      audience: questionnaire.id,
      questionnaireId: questionnaire.id,
      questionnaireVersion: questionnaire.version,
      identification: state.identification,
      answers,
      openAnswer: state.openAnswer.trim() === '' ? null : state.openAnswer.trim(),
      snapshot: buildSnapshot(questionnaire, state.answers),
    }

    submitResponse(payload)
      .then(() => dispatch({ type: 'SET_SUBMISSION', status: 'sent' }))
      .catch((error: unknown) =>
        dispatch({
          type: 'SET_SUBMISSION',
          status: 'error',
          message: error instanceof Error ? error.message : STRINGS.errors.generic,
        }),
      )
      .finally(() => {
        inFlight.current = false
      })
  }, [status, questionnaire, state.answers, state.identification, state.openAnswer, dispatch])

  function retry() {
    dispatch({ type: 'SET_SUBMISSION', status: 'idle' })
  }

  return (
    <Screen
      title={status === 'error' ? STRINGS.thankYou.errorTitle : STRINGS.thankYou.title}
      align="center"
      actions={
        status === 'error' ? (
          <Button onClick={retry}>{STRINGS.actions.retry}</Button>
        ) : status === 'sent' ? (
          <Button onClick={() => dispatch({ type: 'RESET' })}>
            {STRINGS.actions.newQuestionnaire}
          </Button>
        ) : undefined
      }
    >
      {(status === 'idle' || status === 'sending') && (
        <StatusMessage tone="info">{STRINGS.thankYou.sending}</StatusMessage>
      )}

      {status === 'sent' && (
        <>
          <StatusMessage tone="success">{STRINGS.thankYou.sent}</StatusMessage>
          <p>
            {questionnaire?.id === 'company'
              ? STRINGS.thankYou.sentDetailCompany
              : STRINGS.thankYou.sentDetailIndividual}
          </p>
        </>
      )}

      {status === 'error' && (
        <>
          <StatusMessage tone="error">
            {state.submission.message ?? STRINGS.errors.generic}
          </StatusMessage>
          <p>{STRINGS.thankYou.errorDetail}</p>
        </>
      )}
    </Screen>
  )
}
