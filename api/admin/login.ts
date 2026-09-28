import { clientIp, jsonBody, methodNotAllowed, withErrorHandling } from '../../server/http.js'
import type { ApiRequest, ApiResponse } from '../../server/http.js'
import { loginCookie, verifyPassword } from '../../server/auth.js'
import { clearRateLimit, peekRateLimit, recordAttempt } from '../../server/rateLimit.js'

export default withErrorHandling(async (req: ApiRequest, res: ApiResponse) => {
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST')

  // Looked at, not spent: only a wrong password costs an attempt, so an
  // admin who logs in several times a day never locks themselves out.
  const key = `login:${clientIp(req)}`
  const limit = peekRateLimit(key)
  if (!limit.allowed) {
    res.setHeader('Retry-After', String(limit.retryAfterSeconds))
    res.status(429).json({ error: 'Demasiados intentos. Inténtelo más tarde.' })
    return
  }

  const body = jsonBody(req)
  const password =
    typeof body === 'object' && body !== null && 'password' in body
      ? (body as { password: unknown }).password
      : null

  if (typeof password !== 'string' || !verifyPassword(password)) {
    recordAttempt(key)
    res.status(401).json({ error: 'Invalid session.' })
    return
  }

  // Knowing the password proves this was never an attack; give the budget
  // back, so a couple of typos before getting it right cost nothing.
  clearRateLimit(key)
  res.setHeader('Set-Cookie', loginCookie())
  res.status(200).json({ ok: true })
})
