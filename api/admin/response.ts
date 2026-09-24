import { methodNotAllowed, singleParam, withErrorHandling } from '../../server/http.js'
import type { ApiRequest, ApiResponse } from '../../server/http.js'
import { hasValidAdminSession } from '../../server/auth.js'
import { getResponse } from '../../server/responsesRepository.js'

// Ids travel in the QUERY STRING, never as a [dynamic] path segment — see
// the blueprint's serverless routing pitfalls.
export default withErrorHandling(async (req: ApiRequest, res: ApiResponse) => {
  if (req.method !== 'GET') return methodNotAllowed(res, 'GET')
  if (!hasValidAdminSession(req)) {
    res.status(401).json({ error: 'Invalid session.' })
    return
  }

  const id = singleParam(req.query, 'id')
  if (!id) {
    res.status(400).json({ error: 'Missing id.' })
    return
  }

  const response = await getResponse(id)
  if (!response) {
    res.status(404).json({ error: 'Response not found.' })
    return
  }

  res.status(200).json({ response })
})
