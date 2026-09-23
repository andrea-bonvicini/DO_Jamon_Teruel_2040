import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AdminApp } from '../../src/admin/AdminApp'
import { STRINGS } from '../../src/data/strings'
import { QUESTIONNAIRES } from '../../src/data/questionnaires'
import { buildSnapshot } from '../../src/data/snapshot'
import type { Answers } from '../../src/data/types'

const answers: Answers = {
  'C-Q01': { kind: 'option', optionId: 'secadero' },
  'C-Q05': { kind: 'options', optionIds: ['local', 'exportacion'] },
  'C-Q15': { kind: 'scaleRows', values: { 'aporta-valor': 5, controles: 2 } },
}

const listRow = {
  id: 'abc',
  created_at: '2026-03-04T09:05:00.000Z',
  respondent_type: 'company',
  identification: { companyName: 'Secaderos de Teruel S.L.' },
  questionnaire_version: QUESTIONNAIRES.company.version,
  answers,
}

/** A consumer response, and any row collected before the name was required. */
const anonymousRow = {
  ...listRow,
  id: 'def',
  respondent_type: 'individual',
  identification: {},
}

const detail = {
  ...listRow,
  questionnaire_id: 'company',
  questionnaire: buildSnapshot(QUESTIONNAIRES.company, answers, '2026-03-04T09:05:00.000Z'),
  open_answer: 'Más promoción en el exterior.',
}

function ok(body: unknown) {
  return { ok: true, status: 200, json: async () => body }
}

function unauthorised() {
  return { ok: false, status: 401, json: async () => ({ error: 'Invalid session.' }) }
}

describe('the admin panel', () => {
  it('shows the login screen when the session check returns 401', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(unauthorised()) as unknown as typeof fetch
    render(<AdminApp />)

    expect(
      await screen.findByRole('button', { name: STRINGS.admin.login }),
    ).toBeInTheDocument()
  })

  it('goes login → list → detail → back', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(unauthorised()) // initial session check
      .mockResolvedValueOnce(ok({ ok: true })) // login
      .mockResolvedValueOnce(ok({ responses: [listRow] })) // list after login
      .mockResolvedValueOnce(ok({ response: detail })) // detail
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const user = userEvent.setup()
    render(<AdminApp />)

    await user.type(
      await screen.findByLabelText(STRINGS.admin.passwordLabel),
      'una-contrasena',
    )
    await user.click(screen.getByRole('button', { name: STRINGS.admin.login }))

    // The list.
    const row = await screen.findByRole('button', { name: /Empresa/ })
    expect(screen.getByText('Secaderos de Teruel S.L.')).toBeInTheDocument()

    // The detail, rendered from the snapshot.
    await user.click(row)
    expect(await screen.findByText('Secadero / industria elaboradora')).toBeInTheDocument()
    expect(screen.getByText('Local/provincial')).toBeInTheDocument()
    expect(screen.getByText(/La D.O. aporta valor a mi negocio/)).toBeInTheDocument()
    expect(screen.getByText('Más promoción en el exterior.')).toBeInTheDocument()
    // Never a bare option id.
    expect(screen.queryByText('secadero')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: STRINGS.admin.back }))
    expect(await screen.findByRole('button', { name: /Empresa/ })).toBeInTheDocument()
  })

  it('reports a wrong password without claiming a server error', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(unauthorised())
      .mockResolvedValueOnce(unauthorised())
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const user = userEvent.setup()
    render(<AdminApp />)

    await user.type(await screen.findByLabelText(STRINGS.admin.passwordLabel), 'mala')
    await user.click(screen.getByRole('button', { name: STRINGS.admin.login }))

    expect(await screen.findByText(STRINGS.admin.wrongPassword)).toBeInTheDocument()
  })

  it("surfaces a non-401 server error verbatim instead of hanging on 'checking session'", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Missing required environment variable: SUPABASE_URL' }),
    }) as unknown as typeof fetch

    render(<AdminApp />)

    expect(
      await screen.findByText('Missing required environment variable: SUPABASE_URL'),
    ).toBeInTheDocument()
    expect(screen.queryByText(STRINGS.admin.checkingSession)).not.toBeInTheDocument()
  })

  it('shows the company name in the list, and "Anónima" for a consumer', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(ok({ responses: [listRow, anonymousRow] })) as unknown as typeof fetch

    render(<AdminApp />)

    expect(await screen.findByText('Secaderos de Teruel S.L.')).toBeInTheDocument()
    // Rows collected before the name was required still render.
    expect(screen.getByText(STRINGS.admin.anonymous)).toBeInTheDocument()
  })

  it('names the company in the detail view', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(ok({ responses: [listRow] }))
      .mockResolvedValueOnce(ok({ response: detail }))
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const user = userEvent.setup()
    render(<AdminApp />)

    await user.click(await screen.findByRole('button', { name: /Empresa/ }))
    expect(await screen.findByText('companyName')).toBeInTheDocument()
    expect(screen.getAllByText('Secaderos de Teruel S.L.').length).toBeGreaterThan(0)
  })

  it('applies the filters only on submit, and carries them into the export links', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(ok({ responses: [listRow] }))
      .mockResolvedValueOnce(ok({ responses: [] }))
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const user = userEvent.setup()
    render(<AdminApp />)

    await screen.findByRole('button', { name: /Empresa/ })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await user.type(screen.getByLabelText(STRINGS.admin.search), 'teruel')
    // Typing alone must not re-query.
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: STRINGS.admin.apply }))
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/admin/responses?search=teruel&direction=desc')

    expect(await screen.findByText(STRINGS.admin.empty)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: STRINGS.admin.exportWide })).toHaveAttribute(
      'href',
      '/api/admin/export?format=wide&search=teruel&direction=desc',
    )
  })

  it('logs out and returns to the login screen', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(ok({ responses: [listRow] }))
      .mockResolvedValueOnce(ok({ ok: true }))
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const user = userEvent.setup()
    render(<AdminApp />)

    await screen.findByRole('button', { name: /Empresa/ })
    await user.click(screen.getByRole('button', { name: STRINGS.admin.logout }))

    expect(await screen.findByRole('button', { name: STRINGS.admin.login })).toBeInTheDocument()
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/admin/logout')
  })

  it('activates a row with the keyboard', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(ok({ responses: [listRow] }))
      .mockResolvedValueOnce(ok({ response: detail }))
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const user = userEvent.setup()
    render(<AdminApp />)

    const row = await screen.findByRole('button', { name: /Empresa/ })
    row.focus()
    await user.keyboard('{Enter}')

    expect(await screen.findByText('Secadero / industria elaboradora')).toBeInTheDocument()
  })

  it('shows a price with its unit, not a bare number', async () => {
    const priceAnswers: Answers = {
      'I-Q06': { kind: 'option', optionId: 'semanal' },
      'I-Q10': { kind: 'number', value: 9 },
    }
    const priced = {
      id: 'precio',
      created_at: '2026-03-04T09:05:00.000Z',
      respondent_type: 'individual',
      identification: {},
      questionnaire_version: QUESTIONNAIRES.individual.version,
      answers: priceAnswers,
      questionnaire_id: 'individual',
      questionnaire: buildSnapshot(QUESTIONNAIRES.individual, priceAnswers, '2026-03-04T09:05:00.000Z'),
      open_answer: null,
    }

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(ok({ responses: [priced] }))
      .mockResolvedValueOnce(ok({ response: priced }))
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const user = userEvent.setup()
    render(<AdminApp />)

    await user.click(await screen.findByRole('button', { name: /Consumidor/ }))
    expect(await screen.findByText('9 €/kg')).toBeInTheDocument()
  })
})
