import '@testing-library/jest-dom/vitest'
import { vi, beforeEach } from 'vitest'

// No test may reach the network. Every suite that needs fetch stubs it explicitly.
beforeEach(() => {
  globalThis.fetch = vi.fn(() => {
    throw new Error('Unexpected network call in a test. Stub fetch in the suite that needs it.')
  }) as unknown as typeof fetch
})

// jsdom implements neither of these; the flow uses both to put each new step
// at the top of the viewport.
Element.prototype.scrollIntoView = vi.fn()
window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
