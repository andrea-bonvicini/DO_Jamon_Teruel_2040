import { clientIp, jsonBody, methodNotAllowed, withErrorHandling } from '../../server/http'
import type { ApiRequest, ApiResponse } from '../../server/http'
import { loginCookie, verifyPassword } from '../../server/auth'
import { checkRateLimit } from '../../server/rateLimit'

export default withErrorHandling(async (req: ApiRequest, res: ApiResponse) => {
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST')

  const limit = checkRateLimit(`login:${clientIp(req)}`)
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
    res.status(401).json({ error: 'Invalid session.' })
    return
  }

  res.setHeader('Set-Cookie', loginCookie())
  res.status(200).json({ ok: true })
})
