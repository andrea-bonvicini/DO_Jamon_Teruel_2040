/**
 * In-memory sliding window, keyed on the caller's IP.
 *
 * Be honest about what this is: on serverless it lives in one instance's
 * memory, resets on every cold start and is not shared between concurrent
 * instances. It deters casual abuse and nothing more. Server-side validation
 * (`validateSubmission`) and the admin session check are the real protections.
 */
const WINDOW_MS = 10 * 60 * 1000
const MAX_REQUESTS = 10

const hits = new Map<string, number[]>()

export interface RateLimitResult {
  allowed: boolean
  retryAfterSeconds: number
}

/**
 * Whether the key is over its budget, WITHOUT spending any of it.
 *
 * Separate from spending because the two belong to different questions. For
 * a login, the budget is there to slow down somebody guessing passwords, so
 * only a wrong guess should cost anything — counting the successful ones too
 * locks out the one person who knows the password, which is exactly backwards.
 */
export function peekRateLimit(
  key: string,
  now: number = Date.now(),
  maxRequests: number = MAX_REQUESTS,
): RateLimitResult {
  const recent = (hits.get(key) ?? []).filter((at) => at > now - WINDOW_MS)
  hits.set(key, recent)

  if (recent.length >= maxRequests) {
    const oldest = recent[0] ?? now
    return { allowed: false, retryAfterSeconds: Math.ceil((oldest + WINDOW_MS - now) / 1000) }
  }

  return { allowed: true, retryAfterSeconds: 0 }
}

/** Spends one slot of the budget. */
export function recordAttempt(key: string, now: number = Date.now()): void {
  const recent = (hits.get(key) ?? []).filter((at) => at > now - WINDOW_MS)
  recent.push(now)
  hits.set(key, recent)
}

/** Gives the budget back — a correct password proves it was never an attack. */
export function clearRateLimit(key: string): void {
  hits.delete(key)
}

/** Peek and spend in one go, for the endpoints where every call counts. */
export function checkRateLimit(
  key: string,
  now: number = Date.now(),
  maxRequests: number = MAX_REQUESTS,
): RateLimitResult {
  const limit = peekRateLimit(key, now, maxRequests)
  if (limit.allowed) recordAttempt(key, now)
  return limit
}

/** Test seam only. */
export function resetRateLimit(): void {
  hits.clear()
}
