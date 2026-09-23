import { StrictMode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuestionnaireProvider } from '../../src/state/QuestionnaireContext'
import { ThankYouScreen } from '../../src/screens/ThankYouScreen'
import { QuestionnaireFlow } from '../../src/screens/QuestionnaireFlow'
import { STRINGS } from '../../src/data/strings'

const next = () => screen.getByRole('button', { name: STRINGS.actions.next })

/**
 * The provider starts with no audience, so ThankYouScreen alone would have no
 * questionnaire to submit. This walks the real flow to the thank-you step for
 * a respondent who never eats jamón — the shortest complete path.
 */
async function reachThankYou(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: STRINGS.actions.start }))
  await user.click(screen.getByRole('button', { name: /consumidor/i }))
  await user.click(screen.getByRole('checkbox', { name: STRINGS.identification.privacyLabel }))
  await user.click(next())
  await user.click(screen.getByRole('radio', { name: '30–44' }))
  await user.click(next())
  await user.click(screen.getByRole('radio', { name: 'Mujer' }))
  await user.click(next())
  await user.selectOptions(screen.getByRole('combobox'), 'aragon')
  await user.click(next())
  await user.click(screen.getByRole('radio', { name: /Rural/ }))
  await user.click(next())
  await user.click(screen.getByRole('radio', { name: 'Yo, principalmente' }))
  await user.click(next())
  await user.click(screen.getByRole('radio', { name: 'Nunca' }))
  await user.click(next())
}

describe('submission', () => {
  it('confirms only after the POST succeeds', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({}) })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const user = userEvent.setup()
    render(<QuestionnaireFlow />)
    await reachThankYou(user)

    expect(await screen.findByText(STRINGS.thankYou.sent)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/responses')
  })

  it('sends only the answers to visible questions', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({}) })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const user = userEvent.setup()
    render(<QuestionnaireFlow />)
    await reachThankYou(user)
    await screen.findByText(STRINGS.thankYou.sent)

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      answers: Record<string, unknown>
      snapshot: { questions: unknown[]; version: string }
      openAnswer: string | null
    }

    expect(Object.keys(body.answers)).toHaveLength(6)
    expect(body.snapshot.questions).toHaveLength(6)
    expect(body.snapshot.version).toBe('individual@1.0.0')
    expect(body.openAnswer).toBeNull()
  })

  it('shows the error and a working Retry when the POST fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: 'Sin conexión con la base de datos.' }) })
      .mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({}) })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const user = userEvent.setup()
    render(<QuestionnaireFlow />)
    await reachThankYou(user)

    expect(await screen.findByText('Sin conexión con la base de datos.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: STRINGS.thankYou.errorTitle })).toBeInTheDocument()
    // Never a thank-you for a submission that did not reach the database.
    expect(screen.queryByText(STRINGS.thankYou.sent)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: STRINGS.actions.retry }))
    expect(await screen.findByText(STRINGS.thankYou.sent)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('keeps the answers in memory after a failure, so the retry still has them', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: 'boom' }) })
      .mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({}) })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const user = userEvent.setup()
    render(<QuestionnaireFlow />)
    await reachThankYou(user)
    await screen.findByText('boom')
    await user.click(screen.getByRole('button', { name: STRINGS.actions.retry }))
    await screen.findByText(STRINGS.thankYou.sent)

    const first = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as { answers: unknown }
    const second = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)) as { answers: unknown }
    expect(second.answers).toEqual(first.answers)
  })

  it('does not submit twice under StrictMode', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({}) })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const user = userEvent.setup()
    render(
      <StrictMode>
        <QuestionnaireFlow />
      </StrictMode>,
    )
    await reachThankYou(user)
    await screen.findByText(STRINGS.thankYou.sent)

    // Give any duplicate effect a chance to fire.
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('resets to the welcome screen without reloading the page', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 201, json: async () => ({}) }) as unknown as typeof fetch

    const user = userEvent.setup()
    render(<QuestionnaireFlow />)
    await reachThankYou(user)
    await screen.findByText(STRINGS.thankYou.sent)

    await user.click(screen.getByRole('button', { name: STRINGS.actions.newQuestionnaire }))
    expect(screen.getByRole('heading', { name: STRINGS.welcome.title })).toBeInTheDocument()
  })

  it('shows nothing to submit when there is no questionnaire', () => {
    render(
      <QuestionnaireProvider>
        <ThankYouScreen />
      </QuestionnaireProvider>,
    )
    expect(screen.getByText(STRINGS.thankYou.sending)).toBeInTheDocument()
  })

  it('does not promise a company the anonymity it cannot have', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 201, json: async () => ({}) }) as unknown as typeof fetch

    const user = userEvent.setup()
    render(<QuestionnaireFlow />)

    // The company path: a name was given, so the wording must say confidential.
    await user.click(screen.getByRole('button', { name: STRINGS.actions.start }))
    await user.click(screen.getByRole('button', { name: /empresa del sector/i }))
    await user.type(screen.getByLabelText('Nombre de la empresa'), 'Jamones de prueba, S.L.')
    await user.click(screen.getByRole('checkbox', { name: STRINGS.identification.privacyLabel }))

    expect(STRINGS.thankYou.sentDetailCompany).toMatch(/confidencial/)
    expect(STRINGS.thankYou.sentDetailCompany).not.toMatch(/anónima/)
    expect(STRINGS.thankYou.sentDetailIndividual).toMatch(/anónima/)
  })
})
