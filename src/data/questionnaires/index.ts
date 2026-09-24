import type { AudienceId, Questionnaire } from '../types.js'
import { COMPANY_QUESTIONNAIRE } from './company.js'
import { INDIVIDUAL_QUESTIONNAIRE } from './individual.js'

/** The only place either questionnaire is looked up. */
export const QUESTIONNAIRES: Record<AudienceId, Questionnaire> = {
  company: COMPANY_QUESTIONNAIRE,
  individual: INDIVIDUAL_QUESTIONNAIRE,
}

export function getQuestionnaire(audience: AudienceId): Questionnaire {
  return QUESTIONNAIRES[audience]
}
