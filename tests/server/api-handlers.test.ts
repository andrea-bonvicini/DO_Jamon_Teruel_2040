import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import type { ApiRequest, ApiResponse } from '../../server/http'
import type { ResponseRow } from '../../server/responsesRepository'
import { QUESTIONNAIRES } from '../../src/data/questionnaires'
import { buildSnapshot } from '../../src/data/snapshot'
import type { Answers } from '../../src/data/types'

const PASSWORD = 'una-contrasena-larga-y-aleatoria-de-equipo'

beforeAll(() => {
  process.env.ADMIN_PASSWORD_HASH = createHash('sha256').update(PASSWORD).digest('hex')
  process.env.ADMIN_SESSION_SECRET = 'b'.repeat(64)
  process.env.SUPABASE_URL = 'https://example.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
})

// The repository is the seam: no handler test ever reaches Supabase.
const insertResponse = vi.hoisted(() => vi.fn())
const listResponses = vi.hoisted(() => vi.fn())
const getResponse = vi.hoisted(() => vi.fn())
const listResponsesForExport = vi.hoisted(() => vi.fn())
const countResponsesByAudience = vi.hoisted(() => vi.fn())

vi.mock('../../server/responsesRepository', () => ({
  insertResponse,
  listResponses,
  getResponse,
  listResponsesForExport,
  countResponsesByAudience,
}))

const { resetRateLimit } = await import('../../server/rateLimit')
const { createSessionCookieValue, SESSION_COOKIE } = await import('../../server/auth')

const postResponses = (await import('../../api/responses')).default
const postLogin = (await import('../../api/admin/login')).default
const postLogout = (await import('../../api/admin/logout')).default
const getResponsesList = (await import('../../api/admin/responses')).default
const getResponseDetail = (await import('../../api/admin/response')).default
const getExport = (await import('../../api/admin/export')).default

interface Captured {
  statusCode: number
  body: unknown
  sent: string | null
  headers: Record<string, string | string[]>
}

function mockResponse(): { res: ApiResponse; captured: Captured } {
  const captured: Captured = { statusCode: 0, body: undefined, sent: null, headers: {} }
  const res: ApiResponse = {
    status(code) {
      captured.statusCode = code
      return res
    },
    json(body) {
      captured.body = body
    },
    send(body) {
      captured.sent = body
    },
    setHeader(name, value) {
      captured.headers[name] = value
    },
  }
  return { res, captured }
}

function authed(req: Partial<ApiRequest> = {}): ApiRequest {
  return {
    method: 'GET',
    headers: { cookie: `${SESSION_COOKIE}=${createSessionCookieValue()}` },
    ...req,
    // Keep the auth cookie even when the caller passes its own headers.
    ...(req.headers
      ? { headers: { cookie: `${SESSION_COOKIE}=${createSessionCookieValue()}`, ...req.headers } }
      : {}),
  }
}

const answers: Answers = {
  'C-Q01': { kind: 'option', optionId: 'secadero' },
}

function row(): ResponseRow {
  return {
    id: 'abc',
    created_at: '2026-03-04T09:05:00.000Z',
    respondent_type: 'company',
    identification: { companyName: 'Secaderos de Teruel S.L.' },
    questionnaire_id: 'company',
    questionnaire_version: QUESTIONNAIRES.company.version,
    answers,
    questionnaire: buildSnapshot(QUESTIONNAIRES.company, answers, '2026-03-04T09:05:00.000Z'),
    open_answer: null,
  }
}

function fullCompanyPayload() {
  return {
    audience: 'company',
    questionnaireId: 'company',
    questionnaireVersion: QUESTIONNAIRES.company.version,
    identification: { companyName: 'Secaderos de Teruel S.L.' },
    answers: {
      'C-Q01': { kind: 'option', optionId: 'secadero' },
      'C-Q02': { kind: 'option', optionId: '6-20' },
      'C-Q03': { kind: 'option', optionId: '10-25' },
      'C-Q04': { kind: 'option', optionId: '51-75' },
      'C-Q05': { kind: 'options', optionIds: ['local'] },
      'C-Q06': { kind: 'option', optionId: 'crecido' },
      'C-Q07': { kind: 'option', optionId: 'crecera' },
      'C-Q08': { kind: 'options', optionIds: ['precio'] },
      'C-Q09': { kind: 'option', optionId: 'buena' },
      'C-Q10': { kind: 'option', optionId: 'si-clara' },
      'C-Q11': { kind: 'option', optionId: 'si' },
      'C-Q12': { kind: 'option', optionId: 'si' },
      'C-Q13': { kind: 'options', optionIds: ['bienestar'] },
      'C-Q14': { kind: 'option', optionId: 'si' },
      'C-Q15': {
        kind: 'scaleRows',
        values: {
          'aporta-valor': 4,
          controles: 4,
          'ayuda-vender': 4,
          defiende: 4,
          comunicacion: 4,
        },
      },
      'C-Q16': { kind: 'options', optionIds: ['clima'] },
      'C-Q17': { kind: 'options', optionIds: ['exportacion'] },
    },
    openAnswer: null,
  }
}

beforeEach(() => {
  resetRateLimit()
  insertResponse.mockReset().mockResolvedValue('new-id')
  listResponses.mockReset().mockResolvedValue([])
  getResponse.mockReset().mockResolvedValue(null)
  listResponsesForExport.mockReset().mockResolvedValue([])
  countResponsesByAudience.mockReset().mockResolvedValue({ company: 0, individual: 0 })
})

describe('POST /api/responses', () => {
  it('rejects the wrong method with 405 and an Allow header', async () => {
    const { res, captured } = mockResponse()
    await postResponses({ method: 'GET', headers: {} }, res)
    expect(captured.statusCode).toBe(405)
    expect(captured.headers.Allow).toBe('POST')
  })

  it('rejects an invalid payload with 400 and never touches the database', async () => {
    const { res, captured } = mockResponse()
    await postResponses({ method: 'POST', headers: {}, body: { audience: 'nope' } }, res)
    expect(captured.statusCode).toBe(400)
    expect(insertResponse).not.toHaveBeenCalled()
  })

  it('stores a valid submission and returns 201 with the new id', async () => {
    const { res, captured } = mockResponse()
    await postResponses({ method: 'POST', headers: {}, body: fullCompanyPayload() }, res)

    expect(captured.statusCode).toBe(201)
    expect(captured.body).toEqual({ id: 'new-id' })
    expect(insertResponse).toHaveBeenCalledTimes(1)
  })

  it('parses a string body', async () => {
    const { res, captured } = mockResponse()
    await postResponses(
      { method: 'POST', headers: {}, body: JSON.stringify(fullCompanyPayload()) },
      res,
    )
    expect(captured.statusCode).toBe(201)
  })

  it('rate-limits after ten submissions from the same IP', async () => {
    const headers = { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' }
    for (let i = 0; i < 10; i += 1) {
      const { res } = mockResponse()
      await postResponses({ method: 'POST', headers, body: fullCompanyPayload() }, res)
    }

    const { res, captured } = mockResponse()
    await postResponses({ method: 'POST', headers, body: fullCompanyPayload() }, res)

    expect(captured.statusCode).toBe(429)
    expect(captured.headers['Retry-After']).toBeDefined()
    expect(insertResponse).toHaveBeenCalledTimes(10)
  })

  it('returns a JSON 500 rather than crashing when the database fails', async () => {
    insertResponse.mockRejectedValueOnce(new Error('Supabase is down'))
    const { res, captured } = mockResponse()
    await postResponses({ method: 'POST', headers: {}, body: fullCompanyPayload() }, res)

    expect(captured.statusCode).toBe(500)
    expect(captured.body).toEqual({ error: 'Supabase is down' })
  })
})

describe('POST /api/admin/login', () => {
  it('rejects the wrong method', async () => {
    const { res, captured } = mockResponse()
    await postLogin({ method: 'GET', headers: {} }, res)
    expect(captured.statusCode).toBe(405)
  })

  it('sets a session cookie for the right password', async () => {
    const { res, captured } = mockResponse()
    await postLogin({ method: 'POST', headers: {}, body: { password: PASSWORD } }, res)

    expect(captured.statusCode).toBe(200)
    expect(String(captured.headers['Set-Cookie'])).toContain(`${SESSION_COOKIE}=`)
    expect(String(captured.headers['Set-Cookie'])).toContain('HttpOnly')
  })

  it('returns 401 for a wrong password and sets no cookie', async () => {
    const { res, captured } = mockResponse()
    await postLogin({ method: 'POST', headers: {}, body: { password: 'nope' } }, res)

    expect(captured.statusCode).toBe(401)
    expect(captured.headers['Set-Cookie']).toBeUndefined()
  })

  it('returns 401 for a missing password', async () => {
    const { res, captured } = mockResponse()
    await postLogin({ method: 'POST', headers: {}, body: {} }, res)
    expect(captured.statusCode).toBe(401)
  })

  it('rate-limits repeated attempts', async () => {
    const headers = { 'x-forwarded-for': '198.51.100.7' }
    for (let i = 0; i < 10; i += 1) {
      const { res } = mockResponse()
      await postLogin({ method: 'POST', headers, body: { password: 'nope' } }, res)
    }

    const { res, captured } = mockResponse()
    await postLogin({ method: 'POST', headers, body: { password: PASSWORD } }, res)
    expect(captured.statusCode).toBe(429)
  })
})

describe('POST /api/admin/logout', () => {
  it('expires the cookie', async () => {
    const { res, captured } = mockResponse()
    await postLogout({ method: 'POST', headers: {} }, res)
    expect(captured.statusCode).toBe(200)
    expect(String(captured.headers['Set-Cookie'])).toContain('Max-Age=0')
  })

  it('rejects the wrong method', async () => {
    const { res, captured } = mockResponse()
    await postLogout({ method: 'GET', headers: {} }, res)
    expect(captured.statusCode).toBe(405)
  })
})

describe('GET /api/admin/responses', () => {
  it('returns 401 without a session', async () => {
    const { res, captured } = mockResponse()
    await getResponsesList({ method: 'GET', headers: {} }, res)
    expect(captured.statusCode).toBe(401)
    expect(listResponses).not.toHaveBeenCalled()
  })

  it('returns the list for an authenticated caller', async () => {
    listResponses.mockResolvedValueOnce([row()])
    const { res, captured } = mockResponse()
    await getResponsesList(authed(), res)

    expect(captured.statusCode).toBe(200)
    expect((captured.body as { responses: unknown[] }).responses).toHaveLength(1)
  })

  it('carries the real per-audience totals, for the panel tabs', async () => {
    countResponsesByAudience.mockResolvedValueOnce({ company: 500, individual: 87 })
    const { res, captured } = mockResponse()
    await getResponsesList(authed(), res)

    // Not the number of rows returned: the list is capped at 200.
    expect((captured.body as { counts: unknown }).counts).toEqual({ company: 500, individual: 87 })
  })

  it('passes the query filters through to the repository', async () => {
    const { res } = mockResponse()
    await getResponsesList(
      authed({ query: { search: ' teruel ', type: 'company', direction: 'asc' } }),
      res,
    )

    expect(listResponses).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'teruel', respondentType: 'company', ascending: true }),
    )
  })

  it('ignores an unknown respondent type rather than erroring', async () => {
    const { res, captured } = mockResponse()
    await getResponsesList(authed({ query: { type: 'aliens' } }), res)

    expect(captured.statusCode).toBe(200)
    expect(listResponses).toHaveBeenCalledWith(expect.objectContaining({ respondentType: null }))
  })

  it('rejects the wrong method', async () => {
    const { res, captured } = mockResponse()
    await getResponsesList(authed({ method: 'POST' }), res)
    expect(captured.statusCode).toBe(405)
  })
})

describe('GET /api/admin/response', () => {
  it('returns 401 without a session', async () => {
    const { res, captured } = mockResponse()
    await getResponseDetail({ method: 'GET', headers: {}, query: { id: 'abc' } }, res)
    expect(captured.statusCode).toBe(401)
  })

  it('returns 400 without an id', async () => {
    const { res, captured } = mockResponse()
    await getResponseDetail(authed(), res)
    expect(captured.statusCode).toBe(400)
  })

  it('returns 404 for an unknown id', async () => {
    const { res, captured } = mockResponse()
    await getResponseDetail(authed({ query: { id: 'missing' } }), res)
    expect(captured.statusCode).toBe(404)
  })

  it('returns the response for a known id', async () => {
    getResponse.mockResolvedValueOnce(row())
    const { res, captured } = mockResponse()
    await getResponseDetail(authed({ query: { id: 'abc' } }), res)

    expect(captured.statusCode).toBe(200)
    expect((captured.body as { response: ResponseRow }).response.id).toBe('abc')
  })
})

describe('GET /api/admin/export', () => {
  it('returns 401 without a session', async () => {
    const { res, captured } = mockResponse()
    await getExport({ method: 'GET', headers: {} }, res)
    expect(captured.statusCode).toBe(401)
  })

  it('rejects an unknown format', async () => {
    const { res, captured } = mockResponse()
    await getExport(authed({ query: { format: 'pdf' } }), res)
    expect(captured.statusCode).toBe(400)
  })

  it('serves the matrix as a download, named after its population', async () => {
    listResponsesForExport.mockResolvedValueOnce([row()])
    const { res, captured } = mockResponse()
    await getExport(authed({ query: { format: 'matrix', type: 'company' } }), res)

    expect(captured.statusCode).toBe(200)
    expect(captured.headers['Content-Type']).toBe('text/csv; charset=utf-8')
    expect(captured.headers['Content-Disposition']).toBe(
      'attachment; filename="respuestas-empresas.csv"',
    )
    expect(captured.sent).toContain('Identificador')
  })

  it('serves the frequency table under its own filename', async () => {
    listResponsesForExport.mockResolvedValueOnce([row()])
    const { res, captured } = mockResponse()
    await getExport(authed({ query: { format: 'frequency', type: 'individual' } }), res)

    expect(captured.headers['Content-Disposition']).toBe(
      'attachment; filename="frecuencias-consumidores.csv"',
    )
    expect(captured.sent).toContain('Preguntados')
  })

  it('serves the data dictionary', async () => {
    listResponsesForExport.mockResolvedValueOnce([row()])
    const { res, captured } = mockResponse()
    await getExport(authed({ query: { format: 'codebook', type: 'company' } }), res)

    expect(captured.headers['Content-Disposition']).toBe(
      'attachment; filename="diccionario-empresas.csv"',
    )
    expect(captured.sent).toContain('Valores posibles')
  })

  it('says «todas» when no population was filtered', async () => {
    listResponsesForExport.mockResolvedValueOnce([row()])
    const { res, captured } = mockResponse()
    await getExport(authed({ query: { format: 'frequency' } }), res)
    expect(captured.headers['Content-Disposition']).toBe(
      'attachment; filename="frecuencias-todas.csv"',
    )
  })

  it('defaults to the matrix', async () => {
    const { res, captured } = mockResponse()
    await getExport(authed(), res)
    expect(captured.headers['Content-Disposition']).toBe(
      'attachment; filename="respuestas-todas.csv"',
    )
  })

  it('exports one response as a matrix, and 404s for an unknown id', async () => {
    // A frequency table over a single respondent is a column of ones, so the
    // single-id route ignores the format and gives the matrix.
    getResponse.mockResolvedValueOnce(row())
    const { res, captured } = mockResponse()
    await getExport(authed({ query: { id: 'abc', format: 'frequency' } }), res)
    expect(captured.headers['Content-Disposition']).toBe(
      'attachment; filename="respuesta-abc.csv"',
    )

    const missing = mockResponse()
    await getExport(authed({ query: { id: 'nope' } }), missing.res)
    expect(missing.captured.statusCode).toBe(404)
  })

  it('rejects the wrong method', async () => {
    const { res, captured } = mockResponse()
    await getExport(authed({ method: 'POST' }), res)
    expect(captured.statusCode).toBe(405)
  })
})
