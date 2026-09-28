import type { Questionnaire } from './types.js'
import { hasOptions } from './types.js'

/**
 * The immutable name of every answerable thing, for the microdata columns and
 * the codebook.
 *
 * DELIBERATE DEPARTURE from the `B0_Q1_O3` scheme the brief sketched: the
 * codes ARE the ids the questionnaires already use. `C-Q01`, `C-Q01.secadero`,
 * `C-Q15.aporta-valor`.
 *
 * Those ids already satisfy every requirement the scheme was for — immutable,
 * declared in the question definition, decoupled from display text, snapshotted
 * with each response, and untouched by the 2026-09-28 rewordings. Minting a
 * second identifier for the same thing would mean two names per question,
 * which is the condition under which names drift apart. The block is not lost:
 * it travels as `sectionId`, and the codebook carries it in its own column.
 *
 * What was genuinely missing is that the ids never reached the exports — the
 * three CSVs were keyed on Spanish labels alone. That is what this fixes.
 */

/** Separator between a question code and the option or grid row inside it. */
const PART = '.'

export function optionCode(questionId: string, optionId: string): string {
  return `${questionId}${PART}${optionId}`
}

/** A grid row is an item of its question, coded the same way as an option. */
export const itemCode = optionCode

/** Count of options ticked, for a multi-choice question. */
export function selectedCountCode(questionId: string): string {
  return `${questionId}${PART}n_selected`
}

/**
 * Every code a questionnaire can emit, in questionnaire order.
 *
 * Includes the open question, which is not in `questions[]` and so escapes
 * every other loop over it.
 */
export function codesOf(questionnaire: Questionnaire): string[] {
  const codes: string[] = []

  for (const question of questionnaire.questions) {
    codes.push(question.id)

    if (hasOptions(question)) {
      for (const option of question.options) codes.push(optionCode(question.id, option.id))
      if (question.type === 'multi_choice') codes.push(selectedCountCode(question.id))
    }

    if (question.type === 'scale_grid') {
      for (const row of question.rows) codes.push(itemCode(question.id, row.id))
    }
  }

  if (questionnaire.openQuestion) codes.push(OPEN_ANSWER_CODE)

  return codes
}

/** The questionnaire-level open question, which has no id of its own. */
export const OPEN_ANSWER_CODE = 'open_answer'

/**
 * How a value that is not an answer is written in the microdata.
 *
 * Negative sentinels rather than blanks, so that «was never shown this»,
 * «was asked and did not answer» and «declined» stay three different facts
 * instead of collapsing into one empty cell. They are the SPSS/Stata
 * convention and they keep every column numeric.
 *
 * The cost is real and worth stating: anybody who averages a column without
 * reading the codebook gets nonsense. The codebook declares them on every
 * row, and `tests/server/microdata.test.ts` pins them.
 */
export const NOT_SHOWN = -97
export const REFUSED = -98
export const MISSING = -99

export const SENTINELS: Record<number, string> = {
  [NOT_SHOWN]: 'No se le mostró la pregunta',
  [REFUSED]: 'Declinó contestar',
  [MISSING]: 'Se le preguntó y no contestó',
}
