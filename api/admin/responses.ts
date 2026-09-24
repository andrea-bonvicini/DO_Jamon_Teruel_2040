import { methodNotAllowed, withErrorHandling } from '../../server/http.js'
import type { ApiRequest, ApiResponse } from '../../server/http.js'
import { hasValidAdminSession } from '../../server/auth.js'
import { parseListFilters } from '../../server/listFilters.js'
import { countResponsesByAudience, listResponses } from '../../server/responsesRepository.js'

export default withErrorHandling(async (req: ApiRequest, res: ApiResponse) => {
  if (req.method !== 'GET') return methodNotAllowed(res, 'GET')
  if (!hasValidAdminSession(req)) {
    res.status(401).json({ error: 'Invalid session.' })
    return
  }

  // The tabs need real totals, which the capped list cannot provide.
  const [responses, counts] = await Promise.all([
    listResponses(parseListFilters(req)),
    countResponsesByAudience(),
  ])

  res.status(200).json({ responses, counts })
})
