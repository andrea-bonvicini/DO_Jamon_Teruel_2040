import { useEffect, useRef } from 'react'
import { QuestionnaireProvider } from '../state/QuestionnaireContext'
import { useQuestionnaire } from '../state/useQuestionnaire'
import { AudienceScreen } from './AudienceScreen'
import { IdentificationScreen } from './IdentificationScreen'
import { OpenAnswerScreen } from './OpenAnswerScreen'
import { QuestionScreen } from './QuestionScreen'
import { ThankYouScreen } from './ThankYouScreen'
import { WelcomeScreen } from './WelcomeScreen'

export function QuestionnaireFlow() {
  return (
    <QuestionnaireProvider>
      <CurrentStep />
    </QuestionnaireProvider>
  )
}

function CurrentStep() {
  const { state } = useQuestionnaire()
  const topRef = useRef<HTMLDivElement>(null)

  // One question per screen: move the viewport and the reading position to
  // the top of each new step rather than leaving the respondent mid-page.
  useEffect(() => {
    topRef.current?.scrollIntoView({ block: 'start' })
    window.scrollTo({ top: 0 })
  }, [state.stepIndex, state.audience])

  return (
    <div ref={topRef}>
      <StepView />
    </div>
  )
}

function StepView() {
  const { step } = useQuestionnaire()

  switch (step.type) {
    case 'welcome':
      return <WelcomeScreen />
    case 'audience':
      return <AudienceScreen />
    case 'identification':
      return <IdentificationScreen />
    case 'question':
      return <QuestionScreen question={step.question} index={step.index} total={step.total} />
    case 'open-answer':
      return <OpenAnswerScreen />
    case 'thank-you':
      return <ThankYouScreen />
  }
}
