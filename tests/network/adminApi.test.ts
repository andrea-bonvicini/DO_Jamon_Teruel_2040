import { describe, expect, it, vi } from 'vitest'
import {
  InvalidSessionError,
  exportUrl,
  getResponseAdmin,
  listResponsesAdmin,
  loginAdmin,
  logoutAdmin,
} from '../../src/network/adminApi'
import { submitResponse } from '../../src/network/submitResponse'
import type { SubmissionPayload } from '../../src/network/submitResponse'
import { QUESTIONNAIRES } from '../../src/data/questionnaires'
import { buildSnapshot } from '../../src/data/snapshot'

function stubFetch(response: Partial<Response> & { jsonBody?: unknown }) {
  const mock = vi.fn().mockResolvedValue({
    ok: response.ok ?? true,
    status: response.status ?? 200,
    json: async () => response.jsonBody ?? {},
  })
  globalThis.fetch = mock as unknown as typeof fetch
  return mock
}

const payload: SubmissionPayload = {
  audience: 'company',
  questionnaireId: 'company',
  questionnaireVersion: QUESTIONNAIRES.company.version,
  identification: {},
  answers: { 'C-Q01': { kind: 'option', optionId: 'secadero' } },
  openAnswer: null,
  snapshot: buildSnapshot(QUESTIONNAIRES.company, {
    'C-Q01': { kind: 'option', optionId: 'secadero' },
  }),
}

describe('submitResponse', () => {
  it('POSTs JSON to /api/responses', async () => {
    const mock = stubFetch({ ok: true, status: 201 })
    await submitResponse(payload)

    expect(mock).toHaveBeenCalledWith('/api/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  })

  it("propagates the server's error message", async () => {
    stubFetch({ ok: false, status: 400, jsonBody: { error: 'Missing required answer: C-Q09.' } })
    await expect(submitResponse(payload)).rejects.toThrow('Missing required answer: C-Q09.')
  })

  it('falls back to the status code when the body is not JSON', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error('not json')
      },
    }) as unknown as typeof fetch

    await expect(submitResponse(payload)).rejects.toThrow('Submission failed (502).')
  })

  it('propagates a network failure', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch')) as unknown as typeof fetch
    await expect(submitResponse(payload)).rejects.toThrow('Failed to fetch')
  })
})

describe('adminApi', () => {
  it('POSTs the password to /api/admin/login', async () => {
    const mock = stubFetch({ jsonBody: { ok: true } })
    await loginAdmin('secreto')

    expect(mock).toHaveBeenCalledWith('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'secreto' }),
    })
  })

  it('POSTs to /api/admin/logout', async () => {
    const mock = stubFetch({ jsonBody: { ok: true } })
    await logoutAdmin()
    expect(mock).toHaveBeenCalledWith('/api/admin/logout', { method: 'POST' })
  })

  it('turns a 401 into InvalidSessionError', async () => {
    stubFetch({ ok: false, status: 401 })
    await expect(listResponsesAdmin({})).rejects.toBeInstanceOf(InvalidSessionError)
  })

  it('propagates other server errors verbatim', async () => {
    stubFetch({ ok: false, status: 500, jsonBody: { error: 'Missing SUPABASE_URL' } })
    await expect(listResponsesAdmin({})).rejects.toThrow('Missing SUPABASE_URL')
  })

  it('omits empty filters from the list query string', async () => {
    const mock = stubFetch({ jsonBody: { responses: [], counts: { company: 0, individual: 0 } } })
    await listResponsesAdmin({ search: '   ', type: '', direction: undefined })
    expect(mock).toHaveBeenCalledWith('/api/admin/responses', undefined)
  })

  it('includes the filters it is given', async () => {
    const mock = stubFetch({ jsonBody: { responses: [], counts: { company: 0, individual: 0 } } })
    await listResponsesAdmin({ search: 'teruel', type: 'company', direction: 'asc' })
    expect(mock).toHaveBeenCalledWith(
      '/api/admin/responses?search=teruel&type=company&direction=asc',
      undefined,
    )
  })

  it('encodes the id in the detail URL', async () => {
    const mock = stubFetch({ jsonBody: { response: { id: 'a b/c' } } })
    await getResponseAdmin('a b/c')
    expect(mock).toHaveBeenCalledWith('/api/admin/response?id=a%20b%2Fc', undefined)
  })

  it('returns the rows together with the real totals', async () => {
    stubFetch({
      jsonBody: { responses: [{ id: '1' }, { id: '2' }], counts: { company: 500, individual: 87 } },
    })
    const result = await listResponsesAdmin({})

    expect(result.responses).toHaveLength(2)
    // The totals come from the server precisely because the rows are capped.
    expect(result.counts).toEqual({ company: 500, individual: 87 })
  })
})

describe('exportUrl', () => {
  it('builds a wide export URL with no filters', () => {
    expect(exportUrl('wide')).toBe('/api/admin/export?format=wide')
  })

  it('carries the active filters so the CSV matches the screen', () => {
    expect(exportUrl('long', { search: 'teruel', type: 'individual', direction: 'asc' })).toBe(
      '/api/admin/export?format=long&search=teruel&type=individual&direction=asc',
    )
  })

  it('omits empty filters', () => {
    expect(exportUrl('wide', { search: '  ', type: '' })).toBe('/api/admin/export?format=wide')
  })

  it('is never fetched — it is an href', () => {
    // A URL string, not a promise.
    expect(typeof exportUrl('wide')).toBe('string')
  })
})
