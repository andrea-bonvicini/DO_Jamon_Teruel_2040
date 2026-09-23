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

export function checkRateLimit(
  key: string,
  now: number = Date.now(),
  maxRequests: number = MAX_REQUESTS,
): RateLimitResult {
  const since = now - WINDOW_MS
  const recent = (hits.get(key) ?? []).filter((at) => at > since)

  if (recent.length >= maxRequests) {
    const oldest = recent[0] ?? now
    hits.set(key, recent)
    return { allowed: false, retryAfterSeconds: Math.ceil((oldest + WINDOW_MS - now) / 1000) }
  }

  recent.push(now)
  hits.set(key, recent)
  return { allowed: true, retryAfterSeconds: 0 }
}

/** Test seam only. */
export function resetRateLimit(): void {
  hits.clear()
}
