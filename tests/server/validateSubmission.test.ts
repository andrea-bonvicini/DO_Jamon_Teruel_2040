import { describe, expect, it } from 'vitest'
import { validateSubmission } from '../../server/validateSubmission'
import { QUESTIONNAIRES } from '../../src/data/questionnaires'
import type { Answers } from '../../src/data/types'

/** A complete, valid set of answers for the company questionnaire. */
function companyAnswers(): Answers {
  return {
    'C-Q01': { kind: 'option', optionId: 'secadero' },
    'C-Q02': { kind: 'option', optionId: '6-20' },
    'C-Q03': { kind: 'option', optionId: '10-25' },
    'C-Q04': { kind: 'option', optionId: '51-75' },
    'C-Q05': { kind: 'options', optionIds: ['local', 'espana'] },
    'C-Q06': { kind: 'option', optionId: 'crecido' },
    'C-Q07': { kind: 'option', optionId: 'mantendra' },
    'C-Q08': { kind: 'options', optionIds: ['precio', 'energia'] },
    'C-Q09': { kind: 'option', optionId: 'ajustada' },
    'C-Q10': { kind: 'option', optionId: 'ligeramente' },
    'C-Q11': { kind: 'option', optionId: 'si' },
    'C-Q12': { kind: 'option', optionId: 'reservas' },
    'C-Q13': { kind: 'options', optionIds: ['bienestar', 'energia'] },
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
    'C-Q16': { kind: 'options', optionIds: ['clima', 'relevo'] },
    'C-Q17': { kind: 'options', optionIds: ['exportacion'] },
  }
}

function companyPayload(overrides: Record<string, unknown> = {}) {
  return {
    audience: 'company',
    questionnaireId: 'company',
    questionnaireVersion: QUESTIONNAIRES.company.version,
    identification: { companyName: 'Secaderos de Teruel S.L.' },
    answers: companyAnswers(),
    openAnswer: null,
    ...overrides,
  }
}


/** The six unconditional consumer answers, for a respondent who eats jamón. */
function individualBase(frequency: string): Answers {
  return {
    'I-Q01': { kind: 'option', optionId: '30-44' },
    'I-Q02': { kind: 'option', optionId: 'mujer' },
    'I-Q03': { kind: 'option', optionId: 'aragon' },
    'I-Q04': { kind: 'option', optionId: 'rural' },
    'I-Q05': { kind: 'option', optionId: 'yo' },
    'I-Q06': { kind: 'option', optionId: frequency },
  }
}

/** A complete, valid set of answers for a consumer who eats jamón weekly. */
function individualAnswers(): Answers {
  return {
    ...individualBase('semanal'),
    'I-Q07': { kind: 'options', optionIds: ['aperitivo'] },
    'I-Q08': { kind: 'options', optionIds: ['supermercado'] },
    'I-Q09': {
      kind: 'scaleRows',
      values: Object.fromEntries(
        (QUESTIONNAIRES.individual.questions.find((q) => q.id === 'I-Q09') as {
          rows: Array<{ id: string }>
        }).rows.map((row) => [row.id, 4]),
      ),
    },
    'I-Q10': { kind: 'number', value: 8 },
    'I-Q11': { kind: 'number', value: 14 },
    'I-Q12': { kind: 'number', value: 26 },
    'I-Q13': { kind: 'number', value: 40 },
    'I-Q14': { kind: 'option', optionId: 'con-do' },
    'I-Q15': { kind: 'option', optionId: 'suena' },
    'I-Q16': { kind: 'options', optionIds: ['zona', 'controles'] },
    'I-Q17': { kind: 'option', optionId: 'quiza' },
    'I-Q19': { kind: 'option', optionId: 'moderacion' },
    'I-Q20': { kind: 'number', value: 9 },
  }
}

function individualPayload(overrides: Record<string, unknown> = {}) {
  return {
    audience: 'individual',
    questionnaireId: 'individual',
    questionnaireVersion: QUESTIONNAIRES.individual.version,
    identification: {},
    answers: individualAnswers(),
    openAnswer: null,
    ...overrides,
  }
}

describe('validateSubmission — happy path', () => {
  it('accepts a complete company submission', () => {
    const result = validateSubmission(companyPayload())
    expect(result.ok, result.ok ? '' : result.error).toBe(true)
    if (result.ok) {
      expect(result.value.identification).toEqual({ companyName: 'Secaderos de Teruel S.L.' })
    }
  })

  it('rebuilds the snapshot server-side rather than trusting the client', () => {
    const result = validateSubmission(
      companyPayload({ snapshot: { questionnaireId: 'company', version: 'forged', questions: [] } }),
    )
    if (!result.ok) throw new Error(result.error)

    expect(result.value.snapshot.version).toBe(QUESTIONNAIRES.company.version)
    expect(result.value.snapshot.questions).toHaveLength(17)
  })

  it('accepts a consumer who never eats jamón, with only the first six answers', () => {
    const result = validateSubmission({
      audience: 'individual',
      questionnaireId: 'individual',
      questionnaireVersion: QUESTIONNAIRES.individual.version,
      identification: {},
      answers: individualBase('nunca'),
      openAnswer: null,
    })

    expect(result.ok, result.ok ? '' : result.error).toBe(true)
    if (result.ok) expect(result.value.snapshot.questions).toHaveLength(6)
  })

  it('accepts an open answer within the cap', () => {
    const result = validateSubmission(companyPayload({ openAnswer: 'Más promoción.' }))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.openAnswer).toBe('Más promoción.')
  })
})

describe('validateSubmission — rejections', () => {
  it('rejects an unknown audience', () => {
    const result = validateSubmission(companyPayload({ audience: 'government' }))
    expect(result).toEqual({ ok: false, error: 'Unknown audience.' })
  })

  it('rejects a questionnaireId that disagrees with the audience', () => {
    const result = validateSubmission(companyPayload({ questionnaireId: 'individual' }))
    expect(result.ok).toBe(false)
  })

  it('rejects an unknown questionnaire version', () => {
    const result = validateSubmission(companyPayload({ questionnaireVersion: 'company@9.9.9' }))
    expect(result).toEqual({ ok: false, error: 'Unknown questionnaire version.' })
  })

  it('rejects a missing required answer', () => {
    const answers = companyAnswers()
    delete answers['C-Q09']
    const result = validateSubmission(companyPayload({ answers }))
    expect(result).toEqual({ ok: false, error: 'Missing required answer: C-Q09.' })
  })

  it('rejects an answer to a question hidden by a conditional', () => {
    const result = validateSubmission({
      audience: 'individual',
      questionnaireId: 'individual',
      questionnaireVersion: QUESTIONNAIRES.individual.version,
      identification: {},
      answers: {
        ...individualBase('nunca'),
        // Does not apply once "nunca" is chosen.
        'I-Q19': { kind: 'option', optionId: 'si' },
      },
      openAnswer: null,
    })

    expect(result).toEqual({
      ok: false,
      error: 'Answer for a question that does not apply: I-Q19.',
    })
  })

  it('rejects an answer whose kind does not match the question type', () => {
    const answers = companyAnswers()
    answers['C-Q01'] = { kind: 'text', value: 'secadero' }
    const result = validateSubmission(companyPayload({ answers }))
    expect(result).toEqual({ ok: false, error: 'Wrong answer kind for C-Q01.' })
  })

  it('rejects an unknown option id', () => {
    const answers = companyAnswers()
    answers['C-Q01'] = { kind: 'option', optionId: 'bodega' }
    const result = validateSubmission(companyPayload({ answers }))
    expect(result).toEqual({ ok: false, error: 'Unknown option for C-Q01: bodega.' })
  })

  it('rejects more selections than maxSelections allows', () => {
    const answers = companyAnswers()
    answers['C-Q16'] = {
      kind: 'options',
      optionIds: ['clima', 'relevo', 'costes', 'sanidad'],
    }
    const result = validateSubmission(companyPayload({ answers }))
    expect(result).toEqual({ ok: false, error: 'Too many options for C-Q16.' })
  })

  it('rejects an empty multi-choice answer on a required question', () => {
    const answers = companyAnswers()
    answers['C-Q05'] = { kind: 'options', optionIds: [] }
    const result = validateSubmission(companyPayload({ answers }))
    expect(result).toEqual({ ok: false, error: 'Too few options for C-Q05.' })
  })

  it('rejects duplicate options', () => {
    const answers = companyAnswers()
    answers['C-Q05'] = { kind: 'options', optionIds: ['local', 'local'] }
    const result = validateSubmission(companyPayload({ answers }))
    expect(result).toEqual({ ok: false, error: 'Duplicate options for C-Q05.' })
  })

  it('rejects a grid with a missing row', () => {
    const answers = companyAnswers()
    answers['C-Q15'] = { kind: 'scaleRows', values: { 'aporta-valor': 5 } }
    const result = validateSubmission(companyPayload({ answers }))
    expect(result).toEqual({ ok: false, error: 'Missing row for C-Q15: controles.' })
  })

  it('rejects a grid row that is not part of the question', () => {
    const answers = companyAnswers()
    answers['C-Q15'] = {
      kind: 'scaleRows',
      values: { ...((companyAnswers()['C-Q15'] as { values: Record<string, number> }).values), invented: 4 },
    }
    const result = validateSubmission(companyPayload({ answers }))
    expect(result).toEqual({ ok: false, error: 'Unknown row for C-Q15: invented.' })
  })

  it('rejects a grid rating outside the range', () => {
    const answers = companyAnswers()
    const values = (answers['C-Q15'] as { values: Record<string, number> }).values
    values.controles = 9
    const result = validateSubmission(companyPayload({ answers }))
    expect(result).toEqual({ ok: false, error: 'Value out of range for C-Q15/controles.' })
  })

  it('rejects a number outside its declared range', () => {
    const answers = individualAnswers()
    answers['I-Q10'] = { kind: 'number', value: 10_000 }
    const result = validateSubmission(individualPayload({ answers }))
    expect(result).toEqual({ ok: false, error: 'Value out of range for I-Q10.' })
  })

  it('rejects an unknown identification field', () => {
    const result = validateSubmission(
      companyPayload({ identification: { companyName: 'ACME', cif: 'B12345678' } }),
    )
    expect(result).toEqual({ ok: false, error: 'Unknown identification field: cif.' })
  })

  it('rejects a company submission with no company name', () => {
    const result = validateSubmission(companyPayload({ identification: {} }))
    expect(result).toEqual({
      ok: false,
      error: 'Missing required identification field: companyName.',
    })
  })

  it('rejects a blank company name', () => {
    const result = validateSubmission(companyPayload({ identification: { companyName: '   ' } }))
    expect(result.ok).toBe(false)
  })

  it('rejects a company name over 200 characters', () => {
    const result = validateSubmission(
      companyPayload({ identification: { companyName: 'a'.repeat(201) } }),
    )
    expect(result).toEqual({ ok: false, error: 'Identification field too long: companyName.' })
  })

  it('rejects an identification field on the anonymous consumer survey', () => {
    const result = validateSubmission(
      individualPayload({ identification: { companyName: 'ACME' } }),
    )
    expect(result).toEqual({ ok: false, error: 'Unknown identification field: companyName.' })
  })

  it('rejects an over-long open answer', () => {
    const result = validateSubmission(companyPayload({ openAnswer: 'a'.repeat(2001) }))
    expect(result).toEqual({ ok: false, error: 'openAnswer exceeds 2000 characters.' })
  })

  it('rejects an open answer for a questionnaire that has none', () => {
    const result = validateSubmission(individualPayload({ openAnswer: 'algo' }))
    expect(result).toEqual({ ok: false, error: 'This questionnaire has no open question.' })
  })

  it('rejects a non-object payload', () => {
    expect(validateSubmission(null).ok).toBe(false)
    expect(validateSubmission('{}').ok).toBe(false)
    expect(validateSubmission([]).ok).toBe(false)
  })
})
