import { describe, expect, it } from 'vitest'
import { visibleAnswers, visibleQuestions } from '../../src/data/visibility'
import { QUESTIONNAIRES } from '../../src/data/questionnaires'
import type { Answers, Question } from '../../src/data/types'

const QUESTIONS: Question[] = [
  {
    id: 'Q1',
    sectionId: 's',
    label: 'Gate',
    text: 'Gate?',
    type: 'single_choice',
    required: true,
    options: [
      { id: 'yes', text: 'Yes' },
      { id: 'no', text: 'No' },
    ],
  },
  {
    id: 'Q2',
    sectionId: 's',
    label: 'Follow-up',
    text: 'Follow-up?',
    type: 'short_text',
    required: true,
    showIf: { questionId: 'Q1', optionIds: ['yes'] },
  },
  {
    id: 'Q3',
    sectionId: 's',
    label: 'Multi gate',
    text: 'Pick some',
    type: 'multi_choice',
    required: true,
    options: [
      { id: 'a', text: 'A' },
      { id: 'b', text: 'B' },
    ],
  },
  {
    id: 'Q4',
    sectionId: 's',
    label: 'After multi',
    text: 'Only if A',
    type: 'short_text',
    required: false,
    showIf: { questionId: 'Q3', optionIds: ['a'] },
  },
]

describe('visibleQuestions', () => {
  it('shows unconditional questions with no answers at all', () => {
    expect(visibleQuestions(QUESTIONS, {}).map((q) => q.id)).toEqual(['Q1', 'Q3'])
  })

  it('shows a conditional question when its gate matches', () => {
    const answers: Answers = { Q1: { kind: 'option', optionId: 'yes' } }
    expect(visibleQuestions(QUESTIONS, answers).map((q) => q.id)).toEqual(['Q1', 'Q2', 'Q3'])
  })

  it('hides a conditional question when its gate does not match', () => {
    const answers: Answers = { Q1: { kind: 'option', optionId: 'no' } }
    expect(visibleQuestions(QUESTIONS, answers).map((q) => q.id)).toEqual(['Q1', 'Q3'])
  })

  it('treats a multi-choice gate as "any of the listed options"', () => {
    const matching: Answers = { Q3: { kind: 'options', optionIds: ['b', 'a'] } }
    const notMatching: Answers = { Q3: { kind: 'options', optionIds: ['b'] } }
    expect(visibleQuestions(QUESTIONS, matching).map((q) => q.id)).toContain('Q4')
    expect(visibleQuestions(QUESTIONS, notMatching).map((q) => q.id)).not.toContain('Q4')
  })

  it('hides a conditional question when the gate answer has the wrong kind', () => {
    const answers: Answers = { Q1: { kind: 'text', value: 'yes' } }
    expect(visibleQuestions(QUESTIONS, answers).map((q) => q.id)).not.toContain('Q2')
  })
})

describe('visibleAnswers', () => {
  it('retains a hidden answer in state but excludes it from the payload', () => {
    const answers: Answers = {
      Q1: { kind: 'option', optionId: 'no' },
      Q2: { kind: 'text', value: 'answered before the gate flipped' },
    }

    // The caller's state object is untouched…
    expect(answers.Q2).toBeDefined()
    // …but the payload drops the now-hidden answer.
    expect(Object.keys(visibleAnswers(QUESTIONS, answers))).toEqual(['Q1'])
  })

  it('brings a hidden answer back when the gate flips back', () => {
    const answers: Answers = {
      Q1: { kind: 'option', optionId: 'yes' },
      Q2: { kind: 'text', value: 'still here' },
    }
    expect(visibleAnswers(QUESTIONS, answers).Q2).toEqual({ kind: 'text', value: 'still here' })
  })

  it('omits visible questions that have not been answered', () => {
    expect(visibleAnswers(QUESTIONS, {})).toEqual({})
  })
})

describe('the consumer early exit', () => {
  const questions = QUESTIONNAIRES.individual.questions

  it('leaves only the first six questions when the respondent never eats jamón', () => {
    const answers: Answers = { 'I-Q06': { kind: 'option', optionId: 'nunca' } }
    expect(visibleQuestions(questions, answers).map((q) => q.id)).toEqual([
      'I-Q01',
      'I-Q02',
      'I-Q03',
      'I-Q04',
      'I-Q05',
      'I-Q06',
    ])
  })

  it('shows all twenty questions to a weekly consumer', () => {
    const answers: Answers = { 'I-Q06': { kind: 'option', optionId: 'semanal' } }
    expect(visibleQuestions(questions, answers)).toHaveLength(20)
  })

  it('shows only the first six before the frequency question is answered', () => {
    expect(visibleQuestions(questions, {})).toHaveLength(6)
  })
})
