import { describe, expect, it } from 'vitest'
import { QUESTIONNAIRES } from '../../src/data/questionnaires'
import type { Question, Questionnaire } from '../../src/data/types'
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

/**
 * A question added after the transcription, at the Consejo's request on
 * 2026-09-28. They are all follow-ups — an «Otros» box or a «¿por qué?» — and
 * their ids end in `b` so the two sets stay tellable apart.
 */
const isAmendment = (id: string) => id.endsWith('b')

const added = (audience: 'company' | 'individual') =>
  QUESTIONNAIRES[audience].questions.filter((q) => isAmendment(q.id)).map((q) => q.id)

/** True when `question` hangs off `gateId`, directly or through its parent. */
function gatedBy(questionnaire: Questionnaire, question: Question, gateId: string): boolean {
  const seen = new Set<string>()
  let current: Question | undefined = question

  while (current?.showIf) {
    if (current.showIf.questionId === gateId) return true
    if (seen.has(current.id)) return false // a cycle; the data test below forbids it
    seen.add(current.id)
    const parentId: string = current.showIf.questionId
    current = questionnaire.questions.find((entry) => entry.id === parentId)
  }

  return false
}

describe('transcription fidelity', () => {
  // The counts below still pin the SOURCE questionnaires. The amendments are
  // counted separately on purpose: that way adding a follow-up cannot quietly
  // cover up a transcribed question having gone missing.
  it('matches the consumer source: 20 questions, 6 blocks, no open question', () => {
    const q = QUESTIONNAIRES.individual
    expect(q.questions.filter((question) => !isAmendment(question.id))).toHaveLength(20)
    expect(q.sections).toHaveLength(6)
    expect(q.openQuestion).toBeUndefined()
  })

  it('matches the company source: 17 questions, 7 blocks, one open question', () => {
    const q = QUESTIONNAIRES.company
    expect(q.questions.filter((question) => !isAmendment(question.id))).toHaveLength(17)
    expect(q.sections).toHaveLength(7)
    expect(q.openQuestion).toBeDefined()
  })

  it('carries exactly the follow-ups the Consejo asked for', () => {
    // Pinned by id, so adding or dropping one is a deliberate edit here.
    expect(added('company')).toEqual([
      'C-Q07b',
      'C-Q08b',
      'C-Q12b',
      'C-Q13b',
      'C-Q14b',
      'C-Q16b',
      'C-Q17b',
    ])
    expect(added('individual')).toEqual(['I-Q07b', 'I-Q09b', 'I-Q12b'])
  })

  it('never blocks the respondent on a follow-up', () => {
    // They are extras. Making one required would trap somebody who ticked
    // «Otros» and then had nothing to add.
    for (const audience of ['company', 'individual'] as const) {
      for (const question of QUESTIONNAIRES[audience].questions) {
        if (isAmendment(question.id)) expect(question.required, question.id).toBe(false)
      }
    }
  })

  it('gates everything after the consumer frequency question on actually consuming', () => {
    const q = QUESTIONNAIRES.individual
    const index = q.questions.findIndex((question) => question.id === 'I-Q06')
    expect(index).toBeGreaterThan(-1)

    for (const question of q.questions.slice(index + 1)) {
      // Directly or through its parent: a follow-up of a gated question is
      // gated too, because a hidden parent has no answer to match against.
      expect(gatedBy(q, question, 'I-Q06'), question.id).toBe(true)
      if (question.showIf?.questionId === 'I-Q06') {
        expect(question.showIf.optionIds, question.id).not.toContain('nunca')
      }
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

  it('asks every transcribed company question of everyone', () => {
    // The source questionnaire has no conditional logic at all. Only the
    // follow-ups added afterwards may hide, and only behind their own parent.
    for (const question of QUESTIONNAIRES.company.questions) {
      if (isAmendment(question.id)) continue
      expect(question.showIf, question.id).toBeUndefined()
    }
  })

  it('never hangs a follow-up on something that is not right above it', () => {
    // A follow-up must depend on a real, earlier choice question, or it would
    // be unreachable — `visibleQuestions` hides anything whose gate has no
    // answer yet.
    for (const audience of ['company', 'individual'] as const) {
      const questionnaire = QUESTIONNAIRES[audience]
      for (const [index, question] of questionnaire.questions.entries()) {
        if (!isAmendment(question.id) || !question.showIf) continue
        const parentIndex = questionnaire.questions.findIndex(
          (entry) => entry.id === question.showIf!.questionId,
        )
        expect(parentIndex, question.id).toBeGreaterThan(-1)
        expect(parentIndex, question.id).toBeLessThan(index)
      }
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

const marked = (audience: 'company' | 'individual') =>
  QUESTIONNAIRES[audience].questions.filter((question) => question.segment).map((q) => q.id)

describe('the questions the results are broken down by', () => {
  it('is a decision written down, not an accident of ordering', () => {
    // Pinned by id so adding or removing a cut is a deliberate edit here.
    expect(marked('company')).toEqual(['C-Q01', 'C-Q02', 'C-Q03', 'C-Q04'])
    expect(marked('individual')).toEqual(['I-Q01', 'I-Q02', 'I-Q04', 'I-Q05', 'I-Q06'])
  })

  it('never marks a multiple-choice question', () => {
    // One respondent would land in several groups at once and be counted
    // several times, which quietly inflates every figure in the file.
    for (const audience of ['company', 'individual'] as const) {
      for (const question of QUESTIONNAIRES[audience].questions) {
        if (question.segment) expect(question.type).toBe('single_choice')
      }
    }
  })

  it('never marks a question only some respondents are asked', () => {
    // A conditional cut would silently exclude everyone who never saw it.
    for (const audience of ['company', 'individual'] as const) {
      for (const question of QUESTIONNAIRES[audience].questions) {
        if (question.segment) expect(question.showIf).toBeUndefined()
      }
    }
  })

  it('leaves out the 19 autonomous communities on purpose', () => {
    // It would multiply the frequency file by 19 and leave most cells with
    // two or three people. It is still in the matrix for a pivot table.
    const ccaa = QUESTIONNAIRES.individual.questions.find((q) => q.id === 'I-Q03')!
    expect(ccaa.segment).toBeUndefined()
  })

  it('carries the mark into the snapshot, so an old row knows how it was cut', async () => {
    const { buildSnapshot } = await import('../../src/data/snapshot')
    const snapshot = buildSnapshot(QUESTIONNAIRES.company, {
      'C-Q01': { kind: 'option' as const, optionId: 'matadero' },
    })

    expect(snapshot.questions.find((q) => q.id === 'C-Q01')?.segment).toBe(true)
    expect(snapshot.questions.find((q) => q.id === 'C-Q05')?.segment).toBeUndefined()
  })
})
