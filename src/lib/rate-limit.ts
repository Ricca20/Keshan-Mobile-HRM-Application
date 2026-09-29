import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Rate limiting middleware using in-memory tracking.
 * For production with Upstash Redis, configure UPSTASH_REDIS_REST_URL and
 * UPSTASH_REDIS_REST_TOKEN in Vercel environment variables, then swap this
 * implementation for @upstash/ratelimit as documented below.
 *
 * Upstash upgrade path:
 *   import { Ratelimit } from '@upstash/ratelimit'
 *   import { Redis } from '@upstash/redis'
 *   const ratelimit = new Ratelimit({
 *     redis: Redis.fromEnv(),
 *     limiter: Ratelimit.slidingWindow(10, '10 s'),
 *   })
 */

// In-memory store — resets on cold start, good enough for serverless edge
const ipStore = new Map<string, { count: number; resetAt: number }>()

const LIMITS: Record<string, { max: number; windowMs: number }> = {
  '/api/auth': { max: 10, windowMs: 60_000 },         // 10 login attempts / min
  '/api/paysheets/generate': { max: 5, windowMs: 60_000 }, // 5 generates / min
  '/api/paysheets/pay': { max: 10, windowMs: 60_000 },
  '/api/paysheets/acknowledge': { max: 10, windowMs: 60_000 },
  '/api/paysheets/dispute': { max: 10, windowMs: 60_000 },
}

export function rateLimitMiddleware(request: NextRequest): NextResponse | null {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    '127.0.0.1'

  const pathname = request.nextUrl.pathname

  // Find matching limit rule
  const ruleKey = Object.keys(LIMITS).find((key) => pathname.startsWith(key))
  if (!ruleKey) return null

  const rule = LIMITS[ruleKey]
  const storeKey = `${ip}:${ruleKey}`
  const now = Date.now()
  const entry = ipStore.get(storeKey)

  if (!entry || now > entry.resetAt) {
    ipStore.set(storeKey, { count: 1, resetAt: now + rule.windowMs })
    return null
  }

  entry.count++

  if (entry.count > rule.max) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((entry.resetAt - now) / 1000)),
          'X-RateLimit-Limit': String(rule.max),
          'X-RateLimit-Remaining': '0',
        },
      }
    )
  }

  return null
}
