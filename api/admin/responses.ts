import { methodNotAllowed, withErrorHandling } from '../../server/http'
import type { ApiRequest, ApiResponse } from '../../server/http'
import { hasValidAdminSession } from '../../server/auth'
import { parseListFilters } from '../../server/listFilters'
import { listResponses } from '../../server/responsesRepository'

export default withErrorHandling(async (req: ApiRequest, res: ApiResponse) => {
  if (req.method !== 'GET') return methodNotAllowed(res, 'GET')
  if (!hasValidAdminSession(req)) {
    res.status(401).json({ error: 'Invalid session.' })
    return
  }

  const responses = await listResponses(parseListFilters(req))
  res.status(200).json({ responses })
})
