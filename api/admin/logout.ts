import { methodNotAllowed, withErrorHandling } from '../../server/http'
import type { ApiRequest, ApiResponse } from '../../server/http'
import { logoutCookie } from '../../server/auth'

export default withErrorHandling((req: ApiRequest, res: ApiResponse) => {
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST')

  res.setHeader('Set-Cookie', logoutCookie())
  res.status(200).json({ ok: true })
})
