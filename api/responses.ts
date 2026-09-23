import { clientIp, jsonBody, methodNotAllowed, withErrorHandling } from '../server/http'
import type { ApiRequest, ApiResponse } from '../server/http'
import { checkRateLimit } from '../server/rateLimit'
import { insertResponse } from '../server/responsesRepository'
import { validateSubmission } from '../server/validateSubmission'

export default withErrorHandling(async (req: ApiRequest, res: ApiResponse) => {
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST')

  const limit = checkRateLimit(`responses:${clientIp(req)}`)
  if (!limit.allowed) {
    res.setHeader('Retry-After', String(limit.retryAfterSeconds))
    res.status(429).json({ error: 'Demasiados envíos desde esta conexión. Inténtelo más tarde.' })
    return
  }

  const result = validateSubmission(jsonBody(req))
  if (!result.ok) {
    res.status(400).json({ error: result.error })
    return
  }

  const id = await insertResponse(result.value)
  res.status(201).json({ id })
})
