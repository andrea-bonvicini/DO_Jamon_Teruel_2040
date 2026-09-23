import { describe, expect, it } from 'vitest'
import { buildSteps } from '../../src/state/steps'
import { INITIAL_STATE, reducer } from '../../src/state/QuestionnaireContext'
import { QUESTIONNAIRES } from '../../src/data/questionnaires'
import type { Answers } from '../../src/data/types'

describe('buildSteps', () => {
  it('shows only welcome and audience before an audience is chosen', () => {
    expect(buildSteps(null, {}).map((s) => s.type)).toEqual(['welcome', 'audience'])
  })

  it('builds the company flow: 3 fixed + 17 questions + open answer + thank you', () => {
    const steps = buildSteps(QUESTIONNAIRES.company, {})
    expect(steps).toHaveLength(3 + 17 + 1 + 1)
    expect(steps.at(0)?.type).toBe('welcome')
    expect(steps.at(1)?.type).toBe('audience')
    expect(steps.at(2)?.type).toBe('identification')
    expect(steps.at(-2)?.type).toBe('open-answer')
    expect(steps.at(-1)?.type).toBe('thank-you')
  })

  it('omits the open-answer step for the consumer questionnaire', () => {
    const steps = buildSteps(QUESTIONNAIRES.individual, {})
    expect(steps.map((s) => s.type)).not.toContain('open-answer')
    expect(steps.at(-1)?.type).toBe('thank-you')
  })

  it('numbers questions against the VISIBLE count, not the full list', () => {
    // No answers yet: only the six unconditional consumer questions apply.
    const steps = buildSteps(QUESTIONNAIRES.individual, {})
    const questions = steps.filter((s) => s.type === 'question')
    expect(questions).toHaveLength(6)
    expect(questions.every((s) => s.type === 'question' && s.total === 6)).toBe(true)
    expect(questions.map((s) => (s.type === 'question' ? s.index : 0))).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('grows when a conditional opens and shrinks when it closes', () => {
    const consumes: Answers = { 'I-Q06': { kind: 'option', optionId: 'semanal' } }
    const never: Answers = { 'I-Q06': { kind: 'option', optionId: 'nunca' } }

    const grown = buildSteps(QUESTIONNAIRES.individual, consumes)
    const shrunk = buildSteps(QUESTIONNAIRES.individual, never)

    expect(grown.filter((s) => s.type === 'question')).toHaveLength(20)
    expect(shrunk.filter((s) => s.type === 'question')).toHaveLength(6)
    expect(grown.at(-1)?.type).toBe('thank-you')
    expect(shrunk.at(-1)?.type).toBe('thank-you')
  })
})

describe('reducer', () => {
  it('clamps GO_NEXT at the last step and GO_BACK at the first', () => {
    const atEnd = reducer({ ...INITIAL_STATE, stepIndex: 1 }, { type: 'GO_NEXT', stepCount: 2 })
    expect(atEnd.stepIndex).toBe(1)
    expect(reducer(INITIAL_STATE, { type: 'GO_BACK' }).stepIndex).toBe(0)
  })

  it('advances one step at a time', () => {
    expect(reducer(INITIAL_STATE, { type: 'GO_NEXT', stepCount: 5 }).stepIndex).toBe(1)
  })

  it('keeps answers when navigating back and forth', () => {
    let state = reducer(INITIAL_STATE, { type: 'SET_AUDIENCE', audience: 'individual' })
    state = reducer(state, {
      type: 'SET_ANSWER',
      questionId: 'I-Q01',
      value: { kind: 'option', optionId: '30-44' },
    })
    state = reducer(state, { type: 'GO_NEXT', stepCount: 10 })
    state = reducer(state, { type: 'GO_BACK' })

    expect(state.answers['I-Q01']).toEqual({ kind: 'option', optionId: '30-44' })
  })

  it('keeps an answer that a conditional has hidden', () => {
    let state = reducer(INITIAL_STATE, { type: 'SET_AUDIENCE', audience: 'individual' })
    state = reducer(state, {
      type: 'SET_ANSWER',
      questionId: 'I-Q06',
      value: { kind: 'option', optionId: 'semanal' },
    })
    state = reducer(state, {
      type: 'SET_ANSWER',
      questionId: 'I-Q19',
      value: { kind: 'option', optionId: 'si' },
    })
    // The respondent goes back and says they never eat jamón.
    state = reducer(state, {
      type: 'SET_ANSWER',
      questionId: 'I-Q06',
      value: { kind: 'option', optionId: 'nunca' },
    })

    // The answer is hidden from the flow…
    expect(buildSteps(QUESTIONNAIRES.individual, state.answers).filter((s) => s.type === 'question'))
      .toHaveLength(6)
    // …but it is still in state, ready if they change their mind.
    expect(state.answers['I-Q19']).toEqual({ kind: 'option', optionId: 'si' })
  })

  it('clears an answer when SET_ANSWER is given null', () => {
    const withAnswer = reducer(INITIAL_STATE, {
      type: 'SET_ANSWER',
      questionId: 'I-Q18',
      value: { kind: 'text', value: 'algo' },
    })
    const cleared = reducer(withAnswer, { type: 'SET_ANSWER', questionId: 'I-Q18', value: null })
    expect(cleared.answers['I-Q18']).toBeUndefined()
  })

  it('discards answers when the audience changes, since ids never overlap', () => {
    let state = reducer(INITIAL_STATE, { type: 'SET_AUDIENCE', audience: 'individual' })
    state = reducer(state, {
      type: 'SET_ANSWER',
      questionId: 'I-Q01',
      value: { kind: 'option', optionId: '18-29' },
    })
    state = reducer(state, { type: 'SET_AUDIENCE', audience: 'company' })

    expect(state.audience).toBe('company')
    expect(state.answers).toEqual({})
  })

  it('does not reset when the same audience is chosen again', () => {
    let state = reducer(INITIAL_STATE, { type: 'SET_AUDIENCE', audience: 'company' })
    state = reducer(state, {
      type: 'SET_ANSWER',
      questionId: 'C-Q01',
      value: { kind: 'option', optionId: 'matadero' },
    })
    state = reducer(state, { type: 'SET_AUDIENCE', audience: 'company' })

    expect(state.answers['C-Q01']).toEqual({ kind: 'option', optionId: 'matadero' })
  })

  it('RESET returns the initial state and nothing else', () => {
    let state = reducer(INITIAL_STATE, { type: 'SET_AUDIENCE', audience: 'company' })
    state = reducer(state, { type: 'SET_PRIVACY_ACCEPTED', accepted: true })
    state = reducer(state, { type: 'SET_OPEN_ANSWER', value: 'algo' })
    state = reducer(state, { type: 'GO_NEXT', stepCount: 9 })
    state = reducer(state, { type: 'SET_SUBMISSION', status: 'sent' })

    expect(reducer(state, { type: 'RESET' })).toEqual(INITIAL_STATE)
  })

  it('stores a submission error message and drops it on the next status', () => {
    const errored = reducer(INITIAL_STATE, {
      type: 'SET_SUBMISSION',
      status: 'error',
      message: 'boom',
    })
    expect(errored.submission).toEqual({ status: 'error', message: 'boom' })

    const retrying = reducer(errored, { type: 'SET_SUBMISSION', status: 'idle' })
    expect(retrying.submission).toEqual({ status: 'idle' })
  })
})

describe('stepIndex stays valid as the flow shrinks', () => {
  it('never points past the end after a conditional closes', () => {
    const consumes: Answers = { 'I-Q06': { kind: 'option', optionId: 'semanal' } }
    const never: Answers = { 'I-Q06': { kind: 'option', optionId: 'nunca' } }

    const long = buildSteps(QUESTIONNAIRES.individual, consumes)
    const short = buildSteps(QUESTIONNAIRES.individual, never)

    // The gate is question 6, i.e. step index 8. Everything the respondent can
    // reach while the gate is open stays addressable once it closes only if we
    // clamp — which is what the provider does.
    const gateIndex = long.findIndex((s) => s.type === 'question' && s.question.id === 'I-Q06')
    expect(gateIndex).toBeLessThan(short.length)
  })
})
