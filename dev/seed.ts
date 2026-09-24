/**
 * Sample responses for the development store, so the list, the detail view and
 * above all the CSV columns can be reviewed without filling the questionnaire
 * in first.
 *
 * THESE ARE INVENTED. Every company name starts with "EJEMPLO" so a seeded row
 * can never be mistaken for a real one in an export. They exist only in the
 * development server — nothing here reaches Supabase or the production build.
 */
import { QUESTIONNAIRES } from '../src/data/questionnaires/index.js'
import { buildSnapshot } from '../src/data/snapshot.js'
import type { Answers } from '../src/data/types.js'
import type { ResponseRow } from '../server/responsesRepository.js'

function gridAll(questionId: string, audience: 'company' | 'individual', value: number) {
  const question = QUESTIONNAIRES[audience].questions.find((q) => q.id === questionId)
  if (question?.type !== 'scale_grid') throw new Error(`${questionId} is not a grid`)
  return {
    kind: 'scaleRows' as const,
    values: Object.fromEntries(question.rows.map((line) => [line.id, value])),
  }
}

function row(
  id: string,
  createdAt: string,
  audience: 'company' | 'individual',
  identification: Record<string, string | number>,
  answers: Answers,
  openAnswer: string | null,
): ResponseRow {
  const questionnaire = QUESTIONNAIRES[audience]
  return {
    id,
    created_at: createdAt,
    respondent_type: audience,
    identification,
    questionnaire_id: questionnaire.id,
    questionnaire_version: questionnaire.version,
    answers,
    questionnaire: buildSnapshot(questionnaire, answers, createdAt),
    open_answer: openAnswer,
  }
}

const COMPANY_A: Answers = {
  'C-Q01': { kind: 'option', optionId: 'secadero' },
  'C-Q02': { kind: 'option', optionId: '21-50' },
  'C-Q03': { kind: 'option', optionId: 'mas-25' },
  'C-Q04': { kind: 'option', optionId: 'mas-75' },
  'C-Q05': { kind: 'options', optionIds: ['local', 'espana', 'exportacion'] },
  'C-Q06': { kind: 'option', optionId: 'crecido' },
  'C-Q07': { kind: 'option', optionId: 'crecera' },
  'C-Q08': { kind: 'options', optionIds: ['precio', 'mano-obra', 'normativa'] },
  'C-Q09': { kind: 'option', optionId: 'ajustada' },
  'C-Q10': { kind: 'option', optionId: 'si-clara' },
  'C-Q11': { kind: 'option', optionId: 'si' },
  'C-Q12': { kind: 'option', optionId: 'reservas' },
  'C-Q13': { kind: 'options', optionIds: ['bienestar', 'energia', 'huella'] },
  'C-Q14': { kind: 'option', optionId: 'nichos' },
  'C-Q15': {
    kind: 'scaleRows',
    values: {
      'aporta-valor': 5,
      controles: 3,
      'ayuda-vender': 4,
      defiende: 3,
      comunicacion: 2,
    },
  },
  'C-Q16': { kind: 'options', optionIds: ['clima', 'relevo', 'costes'] },
  'C-Q17': { kind: 'options', optionIds: ['exportacion', 'sostenibilidad', 'marca-territorio'] },
}

const COMPANY_B: Answers = {
  'C-Q01': { kind: 'option', optionId: 'ganadera' },
  'C-Q02': { kind: 'option', optionId: '1-5' },
  'C-Q03': { kind: 'option', optionId: '10-25' },
  'C-Q04': { kind: 'option', optionId: 'menos-25' },
  'C-Q05': { kind: 'options', optionIds: ['local'] },
  'C-Q06': { kind: 'option', optionId: 'disminuido' },
  'C-Q07': { kind: 'option', optionId: 'no-lo-se' },
  'C-Q08': { kind: 'options', optionIds: ['piensos', 'energia', 'sanidad'] },
  'C-Q09': { kind: 'option', optionId: 'insuficiente' },
  'C-Q10': { kind: 'option', optionId: 'sin-diferencia' },
  'C-Q11': { kind: 'option', optionId: 'no' },
  'C-Q12': { kind: 'option', optionId: 'no' },
  'C-Q13': { kind: 'options', optionIds: ['ninguna'] },
  'C-Q14': { kind: 'option', optionId: 'no' },
  'C-Q15': gridAll('C-Q15', 'company', 2),
  'C-Q16': { kind: 'options', optionIds: ['relevo', 'costes', 'sanidad'] },
  'C-Q17': { kind: 'options', optionIds: ['marca-territorio'] },
}

const INDIVIDUAL_A: Answers = {
  'I-Q01': { kind: 'option', optionId: '30-44' },
  'I-Q02': { kind: 'option', optionId: 'mujer' },
  'I-Q03': { kind: 'option', optionId: 'aragon' },
  'I-Q04': { kind: 'option', optionId: 'ciudad-media' },
  'I-Q05': { kind: 'option', optionId: 'yo' },
  'I-Q06': { kind: 'option', optionId: 'semanal' },
  'I-Q07': { kind: 'options', optionIds: ['aperitivo', 'celebraciones'] },
  'I-Q08': { kind: 'options', optionIds: ['especializada', 'supermercado'] },
  'I-Q09': gridAll('I-Q09', 'individual', 4),
  'I-Q10': { kind: 'number', value: 9 },
  'I-Q11': { kind: 'number', value: 16 },
  'I-Q12': { kind: 'number', value: 30 },
  'I-Q13': { kind: 'number', value: 48 },
  'I-Q14': { kind: 'option', optionId: 'con-do' },
  'I-Q15': { kind: 'option', optionId: 'bien' },
  'I-Q16': { kind: 'options', optionIds: ['zona', 'controles', 'curacion'] },
  'I-Q17': { kind: 'option', optionId: 'quiza' },
  'I-Q18': { kind: 'text', value: 'Tradición y fiestas familiares' },
  'I-Q19': { kind: 'option', optionId: 'moderacion' },
  'I-Q20': { kind: 'number', value: 9 },
}

export const SEED: ResponseRow[] = [
  row(
    'ejemplo-0001',
    '2026-09-21T09:14:00.000Z',
    'company',
    { companyName: 'EJEMPLO · Secaderos del Bajo Aragón, S.L.' },
    COMPANY_A,
    'Más promoción en el exterior y un sello más reconocible en el lineal.',
  ),
  row(
    'ejemplo-0002',
    '2026-09-22T17:40:00.000Z',
    'company',
    { companyName: 'EJEMPLO · Ganadería Sierra de Albarracín' },
    COMPANY_B,
    null,
  ),
  row('ejemplo-0003', '2026-09-23T08:05:00.000Z', 'individual', {}, INDIVIDUAL_A, null),
]
