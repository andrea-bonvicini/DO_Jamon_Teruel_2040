import { describe, expect, it } from 'vitest'
import { QUESTIONNAIRES } from '../../src/data/questionnaires'
import { codesOf, optionCode, selectedCountCode } from '../../src/data/codes'
import registry from '../../src/data/codeRegistry.json'

/**
 * The registry is what makes one wave comparable with the next.
 *
 * A code is a promise: it names the same thing forever. These tests fail the
 * moment that promise is broken — a code dropped, renamed, or reused for
 * something else — because none of those crash anything at runtime. They just
 * quietly make two waves incomparable, and you find out months later when the
 * trend line does something inexplicable.
 */
const AUDIENCES = ['company', 'individual'] as const

const current = (audience: (typeof AUDIENCES)[number]) => codesOf(QUESTIONNAIRES[audience])

const registered = (audience: string) =>
  Object.entries(registry.codes)
    .filter(([, entry]) => entry.audience === audience && !('retired' in entry))
    .map(([code]) => code)

describe('the code registry', () => {
  it.each(AUDIENCES)('has every code %s can emit', (audience) => {
    // A code in the questionnaire but not in the registry means somebody added
    // a question or an option without declaring it. Add it with the wave it
    // first appears in; that date is what dates the trend break.
    const missing = current(audience).filter((code) => !(code in registry.codes))
    expect(missing).toEqual([])
  })

  it.each(AUDIENCES)('has not silently dropped a %s code', (audience) => {
    // A registered code that no longer exists must be marked `retired`, not
    // deleted. Deleting it loses the fact that the old wave's data uses it.
    const live = new Set(current(audience))
    const vanished = registered(audience).filter((code) => !live.has(code))
    expect(vanished).toEqual([])
  })

  it('never lets one code mean two things', () => {
    const seen = new Map<string, string>()
    for (const audience of AUDIENCES) {
      for (const code of current(audience)) {
        // `open_answer` is the one code both questionnaires could use; only
        // the company one has an open question, so it must not collide.
        expect(seen.has(code), `${code} is used by both questionnaires`).toBe(false)
        seen.set(code, audience)
      }
    }
  })

  it('keeps a code stable when only the wording changes', () => {
    // The 2026-09-28 amendments reworded C-Q09 and C-Q10 without touching a
    // single id, which is exactly the property the codes exist to have.
    const rentabilidad = QUESTIONNAIRES.company.questions.find((q) => q.id === 'C-Q09')!
    expect(rentabilidad.text).toContain('rentabilidad')
    if (!('options' in rentabilidad)) throw new Error('unreachable')

    for (const id of ['buena', 'ajustada', 'insuficiente']) {
      expect(rentabilidad.options.map((option) => option.id)).toContain(id)
      expect(optionCode('C-Q09', id) in registry.codes).toBe(true)
    }
  })

  it('codes every part of a question, not just the question', () => {
    const codes = current('company')

    expect(codes).toContain('C-Q08') // the question
    expect(codes).toContain(optionCode('C-Q08', 'otros')) // each option
    expect(codes).toContain(selectedCountCode('C-Q08')) // how many were ticked
    expect(codes).toContain(optionCode('C-Q15', 'aporta-valor')) // each grid item
    expect(codes).toContain('open_answer') // the question that is in no list
  })

  it('codes nothing for the consumer open question, because there is none', () => {
    expect(current('individual')).not.toContain('open_answer')
  })
})
