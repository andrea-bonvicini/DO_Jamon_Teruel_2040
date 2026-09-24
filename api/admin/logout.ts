import { methodNotAllowed, withErrorHandling } from '../../server/http.js'
import type { ApiRequest, ApiResponse } from '../../server/http.js'
import { logoutCookie } from '../../server/auth.js'

export default withErrorHandling((req: ApiRequest, res: ApiResponse) => {
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST')

  res.setHeader('Set-Cookie', logoutCookie())
  res.status(200).json({ ok: true })
})
