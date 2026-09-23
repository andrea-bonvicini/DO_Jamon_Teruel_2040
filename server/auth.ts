import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { env } from './env'
import { parseCookies } from './http'
import type { ApiRequest } from './http'

export const SESSION_COOKIE = 'do_admin_session'
const SESSION_DURATION_SECONDS = 10 * 60 * 60 // 10 h

/**
 * Plain SHA-256 rather than bcrypt/scrypt is acceptable HERE — and only here —
 * because the secret is a long random team password stored in an environment
 * variable, never a user-chosen one, the hash is never exposed, and there is
 * no per-user salt to protect. If this ever becomes a user-chosen password,
 * switch to scrypt. Do not "fix" it without reading this.
 */
export function hashPassword(password: string): string {
  return createHash('sha256').update(password, 'utf8').digest('hex')
}

export function verifyPassword(password: string): boolean {
  const expected = Buffer.from(env.adminPasswordHash, 'utf8')
  const actual = Buffer.from(hashPassword(password), 'utf8')
  // timingSafeEqual throws on a length mismatch, so check first.
  if (expected.length !== actual.length) return false
  return timingSafeEqual(expected, actual)
}

function sign(payload: string): string {
  return createHmac('sha256', env.adminSessionSecret).update(payload).digest('hex')
}

export function createSessionCookieValue(now: number = Date.now()): string {
  const expiresAt = String(now + SESSION_DURATION_SECONDS * 1000)
  return `${expiresAt}.${sign(expiresAt)}`
}

export function isValidSessionValue(value: string | undefined, now: number = Date.now()): boolean {
  if (!value) return false

  const separator = value.lastIndexOf('.')
  if (separator <= 0) return false

  const expiresAt = value.slice(0, separator)
  const signature = value.slice(separator + 1)
  if (!/^\d+$/.test(expiresAt)) return false

  const expected = Buffer.from(sign(expiresAt), 'utf8')
  const actual = Buffer.from(signature, 'utf8')
  if (expected.length !== actual.length) return false
  if (!timingSafeEqual(expected, actual)) return false

  return Number(expiresAt) > now
}

/** The first line of EVERY admin handler. */
export function hasValidAdminSession(req: ApiRequest, now: number = Date.now()): boolean {
  return isValidSessionValue(parseCookies(req)[SESSION_COOKIE], now)
}

export function sessionCookie(value: string, maxAgeSeconds: number): string {
  return [
    `${SESSION_COOKIE}=${value}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
    `Max-Age=${maxAgeSeconds}`,
  ].join('; ')
}

export function loginCookie(now: number = Date.now()): string {
  return sessionCookie(createSessionCookieValue(now), SESSION_DURATION_SECONDS)
}

export function logoutCookie(): string {
  return sessionCookie('', 0)
}

/** Helper for generating a session secret during setup. */
export function generateSessionSecret(): string {
  return randomBytes(32).toString('hex')
}
