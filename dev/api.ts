/**
 * The six /api routes, served against an ARRAY IN MEMORY, for development only.
 *
 * Why this exists: it lets the whole product be walked end to end — fill in the
 * questionnaire, watch the response land in /admin, download the CSV — without
 * a Supabase project. In production this file is never loaded: `vite.config.mts`
 * mounts it under `apply: 'serve'`, and Vercel serves the real handlers in
 * `api/`, which are the ones the 29 handler tests cover.
 *
 * It deliberately reuses EVERY piece of real logic — validation, auth, filters,
 * CSV — so that what you see here is what you get in production. The only
 * development-specific parts are where rows are kept and the route dispatch.
 * `tests/guards/dev-isolation.test.ts` makes sure nothing in `src/` or `api/`
 * ever imports from here.
 *
 * The store is cleared whenever the dev server restarts. That is deliberate:
 * this is not a database.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { hasValidAdminSession, loginCookie, logoutCookie, verifyPassword } from '../server/auth.js'
import { attachment } from '../server/csv.js'
import {
  buildCodebookCsv,
  buildFrequencyCsv,
  buildMatrixCsv,
  exportFilename,
} from '../server/exports.js'
import type { ExportFormat } from '../server/exports.js'
import { EXPORT_LIMIT, parseListFilters } from '../server/listFilters.js'
import type { ApiRequest } from '../server/http.js'
import { validateSubmission } from '../server/validateSubmission.js'
import type { ResponseRow } from '../server/responsesRepository.js'
import { SEED } from './seed.js'

const store: ResponseRow[] = [...SEED]

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => {
      data += String(chunk)
    })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

/** Adapts Node's request to the shape `server/` expects. */
function toApiRequest(req: IncomingMessage, url: URL, body: unknown): ApiRequest {
  const query: Record<string, string> = {}
  for (const [key, value] of url.searchParams) query[key] = value

  return {
    method: req.method ?? 'GET',
    url: req.url ?? '/',
    headers: req.headers as Record<string, string | string[] | undefined>,
    query,
    body,
  }
}

function json(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

function unauthorised(res: ServerResponse): void {
  json(res, 401, { error: 'Invalid session.' })
}

/** Applies the same filters the repository would hand to Postgres. */
function selectRows(apiRequest: ApiRequest, maxLimit: number): ResponseRow[] {
  const filters = parseListFilters(apiRequest, maxLimit)

  let rows = store.slice()
  if (filters.respondentType) {
    rows = rows.filter((row) => row.respondent_type === filters.respondentType)
  }
  if (filters.search) {
    const needle = filters.search.toLowerCase()
    rows = rows.filter((row) => JSON.stringify(row.identification).toLowerCase().includes(needle))
  }

  rows.sort((a, b) =>
    filters.ascending
      ? a.created_at.localeCompare(b.created_at)
      : b.created_at.localeCompare(a.created_at),
  )

  return rows.slice(0, filters.limit)
}

export async function handleDevApi(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const path = url.pathname
  if (!path.startsWith('/api/')) return false

  const raw = req.method === 'POST' ? await readBody(req) : ''
  let body: unknown = null
  if (raw) {
    try {
      body = JSON.parse(raw)
    } catch {
      body = null
    }
  }

  const apiRequest = toApiRequest(req, url, body)

  // ── POST /api/responses ────────────────────────────────────────────────
  if (path === '/api/responses') {
    if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' }), true

    const result = validateSubmission(body)
    if (!result.ok) return json(res, 400, { error: result.error }), true

    const id = `dev-${String(store.length + 1).padStart(4, '0')}`
    store.push({
      id,
      created_at: new Date().toISOString(),
      respondent_type: result.value.audience,
      identification: result.value.identification,
      questionnaire_id: result.value.questionnaireId,
      questionnaire_version: result.value.questionnaireVersion,
      answers: result.value.answers,
      questionnaire: result.value.snapshot,
      open_answer: result.value.openAnswer,
    })

    console.info(`[dev-api] respuesta guardada: ${id} (${store.length} en total)`)
    return json(res, 201, { id }), true
  }

  // ── POST /api/admin/login ──────────────────────────────────────────────
  if (path === '/api/admin/login') {
    if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' }), true

    const password =
      typeof body === 'object' && body !== null && 'password' in body
        ? (body as { password: unknown }).password
        : null

    if (typeof password !== 'string' || !verifyPassword(password)) {
      return unauthorised(res), true
    }

    res.setHeader('Set-Cookie', loginCookie())
    return json(res, 200, { ok: true }), true
  }

  // ── POST /api/admin/logout ─────────────────────────────────────────────
  if (path === '/api/admin/logout') {
    res.setHeader('Set-Cookie', logoutCookie())
    return json(res, 200, { ok: true }), true
  }

  // Everything below needs a session.
  if (path.startsWith('/api/admin/') && !hasValidAdminSession(apiRequest)) {
    return unauthorised(res), true
  }

  // ── GET /api/admin/responses ───────────────────────────────────────────
  if (path === '/api/admin/responses') {
    const counts = {
      company: store.filter((row) => row.respondent_type === 'company').length,
      individual: store.filter((row) => row.respondent_type === 'individual').length,
    }
    const rows = selectRows(apiRequest, 200).map((row) => ({
      id: row.id,
      created_at: row.created_at,
      respondent_type: row.respondent_type,
      identification: row.identification,
      questionnaire_version: row.questionnaire_version,
      answers: row.answers,
    }))
    return json(res, 200, { responses: rows, counts }), true
  }

  // ── GET /api/admin/response?id= ────────────────────────────────────────
  if (path === '/api/admin/response') {
    const id = url.searchParams.get('id')
    if (!id) return json(res, 400, { error: 'Missing id.' }), true

    const response = store.find((row) => row.id === id)
    if (!response) return json(res, 404, { error: 'Response not found.' }), true

    return json(res, 200, { response }), true
  }

  // ── GET /api/admin/export?format= ──────────────────────────────────────
  if (path === '/api/admin/export') {
    const format = (url.searchParams.get('format') ?? 'matrix') as ExportFormat
    const build = DEV_BUILDERS[format]
    if (!build) {
      return json(res, 400, { error: 'format must be "matrix", "frequency" or "codebook".' }), true
    }

    const id = url.searchParams.get('id')
    if (id) {
      const response = store.find((row) => row.id === id)
      if (!response) return json(res, 404, { error: 'Response not found.' }), true
      return sendCsv(res, `respuesta-${id}.csv`, buildMatrixCsv([response])), true
    }

    const rows = selectRows(apiRequest, EXPORT_LIMIT)
    const audience = parseListFilters(apiRequest, EXPORT_LIMIT).respondentType
    return sendCsv(res, exportFilename(format, audience), build(rows)), true
  }

  return json(res, 404, { error: 'Unknown route.' }), true
}

const DEV_BUILDERS: Record<ExportFormat, (rows: ResponseRow[]) => string> = {
  matrix: buildMatrixCsv,
  frequency: buildFrequencyCsv,
  codebook: buildCodebookCsv,
}

function sendCsv(res: ServerResponse, filename: string, csv: string): void {
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', attachment(filename))
  res.end(csv)
}
