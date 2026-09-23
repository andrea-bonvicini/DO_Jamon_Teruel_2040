import type { AudienceId, Option } from './types'

export interface IdentificationField {
  id: string
  label: string
  type: 'short_text' | 'select' | 'number' | 'email'
  required: boolean
  options?: Option[] // for 'select'
  maxLength?: number
  help?: string
}

/**
 * The two audiences are deliberately not treated alike.
 *
 * COMPANIES are a census of roughly 200 named firms, so the company name is
 * required: without it the responses cannot be de-duplicated or followed up.
 * The privacy notice on that screen says so — it promises confidentiality and
 * aggregate reporting, not anonymity.
 *
 * CONSUMERS stay fully anonymous, as their source document promises. Their
 * demographic questions (Bloque A) are numbered questions in the survey
 * itself, not identification fields, so nothing here identifies them.
 *
 * See DECISIONS.md.
 */
export const IDENTIFICATION: Record<AudienceId, IdentificationField[]> = {
  company: [
    {
      id: 'companyName',
      label: 'Nombre de la empresa',
      type: 'short_text',
      required: true,
      maxLength: 200,
    },
  ],
  individual: [],
}
