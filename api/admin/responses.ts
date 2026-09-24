import { methodNotAllowed, withErrorHandling } from '../../server/http.js'
import type { ApiRequest, ApiResponse } from '../../server/http.js'
import { hasValidAdminSession } from '../../server/auth.js'
import { parseListFilters } from '../../server/listFilters.js'
import { listResponses } from '../../server/responsesRepository.js'

export default withErrorHandling(async (req: ApiRequest, res: ApiResponse) => {
  if (req.method !== 'GET') return methodNotAllowed(res, 'GET')
  if (!hasValidAdminSession(req)) {
    res.status(401).json({ error: 'Invalid session.' })
    return
  }

  const responses = await listResponses(parseListFilters(req))
  res.status(200).json({ responses })
})
