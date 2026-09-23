import { describe, expect, it } from 'vitest'
import { QUESTIONNAIRES } from '../../src/data/questionnaires'
import type { Questionnaire } from '../../src/data/types'
import { hasOptions } from '../../src/data/types'

const entries = Object.entries(QUESTIONNAIRES) as Array<[string, Questionnaire]>

describe.each(entries)('questionnaire "%s"', (audience, questionnaire) => {
  it('is registered under its own id', () => {
    expect(questionnaire.id).toBe(audience)
  })

  it('has a semver version namespaced to its audience', () => {
    expect(questionnaire.version).toMatch(/^(company|individual)@\d+\.\d+\.\d+$/)
    expect(questionnaire.version.startsWith(`${questionnaire.id}@`)).toBe(true)
  })

  it('has at least one section, with unique ids and unique orders', () => {
    const ids = questionnaire.sections.map((s) => s.id)
    const orders = questionnaire.sections.map((s) => s.order)
    expect(ids.length).toBeGreaterThan(0)
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(orders).size).toBe(orders.length)
  })

  it('has unique question ids', () => {
    const ids = questionnaire.questions.map((q) => q.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('gives every question a non-empty label and text', () => {
    for (const question of questionnaire.questions) {
      expect(question.label.trim(), question.id).not.toBe('')
      expect(question.text.trim(), question.id).not.toBe('')
    }
  })

  it('points every question at an existing section', () => {
    const sectionIds = new Set(questionnaire.sections.map((s) => s.id))
    for (const question of questionnaire.questions) {
      expect(sectionIds.has(question.sectionId), `${question.id} -> ${question.sectionId}`).toBe(
        true,
      )
    }
  })

  it('gives every choice question at least two options with unique ids', () => {
    for (const question of questionnaire.questions) {
      if (!hasOptions(question)) continue
      expect(question.options.length, question.id).toBeGreaterThanOrEqual(2)
      const ids = question.options.map((o) => o.id)
      expect(new Set(ids).size, question.id).toBe(ids.length)
      for (const option of question.options) {
        expect(option.text.trim(), `${question.id}/${option.id}`).not.toBe('')
      }
    }
  })

  it('keeps multi-choice selection bounds coherent', () => {
    for (const question of questionnaire.questions) {
      if (question.type !== 'multi_choice') continue
      const min = question.minSelections ?? 0
      const max = question.maxSelections ?? question.options.length
      expect(min, question.id).toBeGreaterThanOrEqual(0)
      expect(max, question.id).toBeGreaterThanOrEqual(min)
      expect(max, question.id).toBeLessThanOrEqual(question.options.length)
      if (question.required) expect(min, question.id).toBeGreaterThanOrEqual(1)
    }
  })

  it('keeps scale and scale_grid ranges coherent', () => {
    for (const question of questionnaire.questions) {
      if (question.type !== 'scale' && question.type !== 'scale_grid') continue
      expect(question.min, question.id).toBeLessThan(question.max)
      expect(Number.isInteger(question.min), question.id).toBe(true)
      expect(Number.isInteger(question.max), question.id).toBe(true)
    }
  })

  it('gives every scale_grid at least two rows with unique ids', () => {
    for (const question of questionnaire.questions) {
      if (question.type !== 'scale_grid') continue
      expect(question.rows.length, question.id).toBeGreaterThanOrEqual(2)
      const ids = question.rows.map((r) => r.id)
      expect(new Set(ids).size, question.id).toBe(ids.length)
      for (const row of question.rows) {
        expect(row.text.trim(), `${question.id}/${row.id}`).not.toBe('')
      }
    }
  })

  it('keeps number ranges coherent', () => {
    for (const question of questionnaire.questions) {
      if (question.type !== 'number') continue
      if (question.min !== undefined && question.max !== undefined) {
        expect(question.min, question.id).toBeLessThan(question.max)
      }
    }
  })

  it('only references EARLIER questions from showIf', () => {
    const seen = new Set<string>()
    for (const question of questionnaire.questions) {
      if (question.showIf) {
        expect(
          seen.has(question.showIf.questionId),
          `${question.id} depends on ${question.showIf.questionId}, which is not an earlier question`,
        ).toBe(true)
      }
      seen.add(question.id)
    }
  })

  it('only references option ids that exist on the referenced question', () => {
    const byId = new Map(questionnaire.questions.map((q) => [q.id, q]))
    for (const question of questionnaire.questions) {
      const showIf = question.showIf
      if (!showIf) continue

      const target = byId.get(showIf.questionId)
      expect(target, `${question.id} -> ${showIf.questionId}`).toBeDefined()
      if (!target || !hasOptions(target)) {
        throw new Error(`${question.id} depends on ${showIf.questionId}, which has no options`)
      }

      expect(showIf.optionIds.length, question.id).toBeGreaterThan(0)
      const optionIds = new Set(target.options.map((o) => o.id))
      for (const optionId of showIf.optionIds) {
        expect(optionIds.has(optionId), `${question.id} -> ${showIf.questionId}/${optionId}`).toBe(
          true,
        )
      }
    }
  })

  it('caps the open question at 2000 characters', () => {
    if (!questionnaire.openQuestion) return
    expect(questionnaire.openQuestion.maxLength).toBeLessThanOrEqual(2000)
    expect(questionnaire.openQuestion.text.trim()).not.toBe('')
  })
})

describe('transcription fidelity', () => {
  it('matches the consumer source: 20 questions, 6 blocks, no open question', () => {
    const q = QUESTIONNAIRES.individual
    expect(q.questions).toHaveLength(20)
    expect(q.sections).toHaveLength(6)
    expect(q.openQuestion).toBeUndefined()
  })

  it('matches the company source: 17 questions, 7 blocks, one open question', () => {
    const q = QUESTIONNAIRES.company
    expect(q.questions).toHaveLength(17)
    expect(q.sections).toHaveLength(7)
    expect(q.openQuestion).toBeDefined()
  })

  it('gates everything after the consumer frequency question on actually consuming', () => {
    const q = QUESTIONNAIRES.individual
    const index = q.questions.findIndex((question) => question.id === 'I-Q06')
    expect(index).toBeGreaterThan(-1)

    for (const question of q.questions.slice(index + 1)) {
      expect(question.showIf?.questionId, question.id).toBe('I-Q06')
      expect(question.showIf?.optionIds, question.id).not.toContain('nunca')
    }
  })

  it('caps the company "máximo 3" questions at three selections', () => {
    const q = QUESTIONNAIRES.company
    for (const id of ['C-Q08', 'C-Q16', 'C-Q17']) {
      const question = q.questions.find((entry) => entry.id === id)
      expect(question?.type, id).toBe('multi_choice')
      if (question?.type !== 'multi_choice') throw new Error('unreachable')
      expect(question.maxSelections, id).toBe(3)
    }
  })

  it('asks the company questionnaire of everyone', () => {
    for (const question of QUESTIONNAIRES.company.questions) {
      expect(question.showIf, question.id).toBeUndefined()
    }
  })
})

describe('the snapshot carries what a human needs to read a row back', () => {
  it('records the unit of every number question', async () => {
    const { buildSnapshot } = await import('../../src/data/snapshot')

    const answers = {
      'I-Q06': { kind: 'option' as const, optionId: 'semanal' },
      'I-Q10': { kind: 'number' as const, value: 9 },
    }
    const snapshot = buildSnapshot(QUESTIONNAIRES.individual, answers)
    const price = snapshot.questions.find((question) => question.id === 'I-Q10')

    // Without this a stored 9 is ambiguous: nine euros, nine kilos, nine years?
    expect(price?.unit).toBe('€/kg')
  })

  it('leaves the unit off questions that have none', async () => {
    const { buildSnapshot } = await import('../../src/data/snapshot')

    const snapshot = buildSnapshot(QUESTIONNAIRES.company, {
      'C-Q01': { kind: 'option' as const, optionId: 'matadero' },
    })
    expect(snapshot.questions.find((q) => q.id === 'C-Q01')?.unit).toBeUndefined()
  })
})
