import { Button } from '../components/Button'
import { Screen } from '../components/Screen'
import { TextArea } from '../components/TextArea'
import { STRINGS } from '../data/strings'
import { useQuestionnaire } from '../state/useQuestionnaire'

export function OpenAnswerScreen() {
  const { state, dispatch, steps, questionnaire } = useQuestionnaire()
  const openQuestion = questionnaire?.openQuestion
  const questionCount = steps.filter((step) => step.type === 'question').length
  if (!openQuestion) return null

  return (
    <Screen
      title={openQuestion.text}
      subtitle={STRINGS.question.optional}
      /* The open question is the last one, so the bar reads as full. */
      progress={{ current: questionCount + 1, total: questionCount + 1, label: STRINGS.openAnswer.progress }}
      actions={
        <>
          <Button variant="secondary" onClick={() => dispatch({ type: 'GO_BACK' })}>
            {STRINGS.actions.back}
          </Button>
          <Button onClick={() => dispatch({ type: 'GO_NEXT', stepCount: steps.length })}>
            {STRINGS.actions.finish}
          </Button>
        </>
      }
    >
      <TextArea
        label={openQuestion.text}
        hideLabel
        value={state.openAnswer}
        maxLength={openQuestion.maxLength}
        placeholder={openQuestion.placeholder}
        onChange={(value) => dispatch({ type: 'SET_OPEN_ANSWER', value })}
      />
    </Screen>
  )
}
