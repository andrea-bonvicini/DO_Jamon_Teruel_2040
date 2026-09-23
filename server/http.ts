/**
 * Minimal request/response shapes, defined here rather than imported from
 * `@vercel/node`, so the server code stays testable with plain objects and
 * carries no platform dependency.
 */
export interface ApiRequest {
  method?: string
  url?: string
  headers: Record<string, string | string[] | undefined>
  query?: Record<string, string | string[] | undefined>
  body?: unknown
}

export interface ApiResponse {
  status(code: number): ApiResponse
  json(body: unknown): void
  send(body: string): void
  setHeader(name: string, value: string | string[]): void
}

export type Handler = (req: ApiRequest, res: ApiResponse) => Promise<void> | void

/** The first value of a query parameter that may arrive repeated. */
export function singleParam(
  query: Record<string, string | string[] | undefined> | undefined,
  key: string,
): string | undefined {
  const value = query?.[key]
  if (value === undefined) return undefined
  return Array.isArray(value) ? value[0] : value
}

export function parseCookies(req: ApiRequest): Record<string, string> {
  const header = req.headers.cookie
  const raw = Array.isArray(header) ? header.join('; ') : header
  if (!raw) return {}

  const cookies: Record<string, string> = {}
  for (const part of raw.split(';')) {
    const index = part.indexOf('=')
    if (index === -1) continue
    const name = part.slice(0, index).trim()
    if (name === '') continue
    cookies[name] = decodeURIComponent(part.slice(index + 1).trim())
  }
  return cookies
}

/** The first hop of `x-forwarded-for`, used as the rate-limit key. */
export function clientIp(req: ApiRequest): string {
  const header = req.headers['x-forwarded-for']
  const raw = Array.isArray(header) ? header[0] : header
  return raw?.split(',')[0]?.trim() || 'unknown'
}

export function methodNotAllowed(res: ApiResponse, allowed: string): void {
  res.setHeader('Allow', allowed)
  res.status(405).json({ error: `Method not allowed. Use ${allowed}.` })
}

/**
 * Every route is wrapped in this. Without it an uncaught throw — a missing
 * env var, a Supabase outage — returns the platform's bodiless
 * FUNCTION_INVOCATION_FAILED, which is undebuggable from the browser.
 */
export function withErrorHandling(handler: Handler): Handler {
  return async (req, res) => {
    try {
      await handler(req, res)
    } catch (error) {
      // Server-side only; never reaches the respondent.
      console.error('[api] unhandled error', error)
      const message = error instanceof Error ? error.message : 'Unexpected server error.'
      res.status(500).json({ error: message })
    }
  }
}

/** Reads a JSON body whether the platform parsed it or handed us a string. */
export function jsonBody(req: ApiRequest): unknown {
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body)
    } catch {
      return null
    }
  }
  return req.body ?? null
}
