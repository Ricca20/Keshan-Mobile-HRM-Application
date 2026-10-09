/**
 * Best-effort, per-instance fixed-window rate limiter.
 *
 * Serverless instances don't share memory, so this only slows down bursts against a
 * single instance. Account-level protection lives in the database (login lockout in
 * lib/auth.ts, per-email throttling in the forgot-password route). For a hard global
 * limit, swap this for @upstash/ratelimit backed by Redis.
 */
const store = new Map<string, { count: number; resetAt: number }>()

export const RATE_LIMITS: Record<string, { max: number; windowMs: number }> = {
  '/api/auth/callback/credentials': { max: 10, windowMs: 60_000 },
  '/api/auth/forgot-password': { max: 5, windowMs: 60_000 },
  '/api/auth/reset-password': { max: 10, windowMs: 60_000 },
}

/** Returns seconds until retry when the limit is exceeded, otherwise null. */
export function checkRateLimit(ip: string, pathname: string): number | null {
  const rule = RATE_LIMITS[pathname]
  if (!rule) return null

  const now = Date.now()
  const key = `${ip}:${pathname}`
  const entry = store.get(key)

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + rule.windowMs })
    if (store.size > 10_000) {
      for (const [k, v] of store) if (now > v.resetAt) store.delete(k)
    }
    return null
  }

  entry.count++
  return entry.count > rule.max ? Math.ceil((entry.resetAt - now) / 1000) : null
}
