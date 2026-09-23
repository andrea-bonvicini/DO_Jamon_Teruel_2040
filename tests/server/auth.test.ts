import { beforeAll, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'

const PASSWORD = 'una-contrasena-larga-y-aleatoria-de-equipo'

beforeAll(() => {
  process.env.ADMIN_PASSWORD_HASH = createHash('sha256').update(PASSWORD).digest('hex')
  process.env.ADMIN_SESSION_SECRET = 'a'.repeat(64)
})

const auth = await import('../../server/auth')

describe('verifyPassword', () => {
  it('accepts the configured password', () => {
    expect(auth.verifyPassword(PASSWORD)).toBe(true)
  })

  it('rejects a wrong password', () => {
    expect(auth.verifyPassword('otra')).toBe(false)
  })

  it('rejects an empty password', () => {
    expect(auth.verifyPassword('')).toBe(false)
  })

  it('rejects a password that only differs in case', () => {
    expect(auth.verifyPassword(PASSWORD.toUpperCase())).toBe(false)
  })
})

describe('the session cookie', () => {
  it('accepts a freshly signed value', () => {
    const now = Date.now()
    expect(auth.isValidSessionValue(auth.createSessionCookieValue(now), now + 1000)).toBe(true)
  })

  it('rejects a value whose expiry has passed', () => {
    const now = Date.now()
    const value = auth.createSessionCookieValue(now)
    // 10 h + 1 s later.
    expect(auth.isValidSessionValue(value, now + 10 * 60 * 60 * 1000 + 1000)).toBe(false)
  })

  it('rejects a tampered expiry', () => {
    const now = Date.now()
    const value = auth.createSessionCookieValue(now)
    const signature = value.slice(value.lastIndexOf('.') + 1)
    const forged = `${now + 99 * 60 * 60 * 1000}.${signature}`
    expect(auth.isValidSessionValue(forged, now)).toBe(false)
  })

  it('rejects a tampered signature', () => {
    const now = Date.now()
    const value = auth.createSessionCookieValue(now)
    expect(auth.isValidSessionValue(`${value}00`, now)).toBe(false)
  })

  it('rejects malformed and missing values', () => {
    expect(auth.isValidSessionValue(undefined)).toBe(false)
    expect(auth.isValidSessionValue('')).toBe(false)
    expect(auth.isValidSessionValue('nonsense')).toBe(false)
    expect(auth.isValidSessionValue('.abc')).toBe(false)
    expect(auth.isValidSessionValue('notanumber.abc')).toBe(false)
  })
})

describe('cookie flags', () => {
  it('sets HttpOnly, Secure, SameSite=Strict and a 10 h Max-Age on login', () => {
    const cookie = auth.loginCookie()
    expect(cookie).toContain('Path=/')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Secure')
    expect(cookie).toContain('SameSite=Strict')
    expect(cookie).toContain('Max-Age=36000')
  })

  it('expires the cookie on logout', () => {
    expect(auth.logoutCookie()).toContain('Max-Age=0')
  })
})

describe('hasValidAdminSession', () => {
  it('reads the session out of the Cookie header', () => {
    const now = Date.now()
    const value = auth.createSessionCookieValue(now)
    const req = { headers: { cookie: `other=1; ${auth.SESSION_COOKIE}=${value}` } }
    expect(auth.hasValidAdminSession(req, now)).toBe(true)
  })

  it('rejects a request with no cookie at all', () => {
    expect(auth.hasValidAdminSession({ headers: {} })).toBe(false)
  })
})
