import { useContext } from 'react'
import { QuestionnaireContext } from './QuestionnaireContext'
import type { QuestionnaireContextValue } from './QuestionnaireContext'

export function useQuestionnaire(): QuestionnaireContextValue {
  const value = useContext(QuestionnaireContext)
  if (!value) throw new Error('useQuestionnaire must be used inside a QuestionnaireProvider')
  return value
}
