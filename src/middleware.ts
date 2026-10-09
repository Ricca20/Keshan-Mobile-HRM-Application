import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { checkRateLimit } from '@/lib/rate-limit'

// NOTE: Next 16 deprecates `middleware.ts` in favour of `proxy.ts`. Rename the file
// and this function to `proxy` when convenient; behaviour is identical.

const AUTH_PAGES = ['/login', '/setup-password', '/reset-password', '/forgot-password']

const ADMIN_ONLY_APIS = [
  '/api/employees',
  '/api/shops',
  '/api/settings',
  '/api/clock/logs',
  '/api/paysheets/generate',
  '/api/paysheets/finalize',
  '/api/paysheets/export',
  '/api/paysheets/pay',
  '/api/paysheets/resolve',
  '/api/leave/types',
  '/api/verification/send',
  '/api/verification/penalize',
  '/api/admin',
  '/api/hrms',
  '/api/ip',
]
const EMPLOYEE_ONLY_APIS = [
  '/api/clock/in',
  '/api/clock/out',
  '/api/verification/check',
  '/api/verification/verify',
  '/api/paysheets/acknowledge',
  '/api/paysheets/dispute',
]

function matches(pathname: string, prefixes: string[]) {
  return prefixes.some(p => pathname === p || pathname.startsWith(`${p}/`))
}

function clientIp(req: NextRequest) {
  return (
    req.headers.get('x-real-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  )
}

export async function middleware(req: NextRequest) {
  const { nextUrl } = req
  const { pathname } = nextUrl
  const isApi = pathname.startsWith('/api/')

  // 1. Rate limiting for credential endpoints (the real login endpoint is the NextAuth callback)
  if (req.method === 'POST') {
    const retryAfter = checkRateLimit(clientIp(req), pathname)
    if (retryAfter !== null) {
      return NextResponse.json(
        { error: 'Too many requests, please try again later.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      )
    }
  }

  // 2. Public endpoints: NextAuth itself, password flows, and cron (protected by CRON_SECRET in the handler)
  if (pathname.startsWith('/api/auth/') || pathname.startsWith('/api/cron/')) {
    return NextResponse.next()
  }

  const isProduction = process.env.NODE_ENV === 'production'
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
    secureCookie: isProduction,
    salt: isProduction ? '__Secure-authjs.session-token' : 'authjs.session-token'
  })

  const isLoggedIn = !!token && token.error !== 'Deactivated'
  const isAuthPage = AUTH_PAGES.some(p => pathname.startsWith(p))
  const isLanding = pathname === '/'

  // 3. Unauthenticated
  if (!isLoggedIn) {
    if (isApi) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (isAuthPage || isLanding) return NextResponse.next()

    const loginUrl = new URL('/login', nextUrl)
    loginUrl.searchParams.set('callbackUrl', pathname + nextUrl.search)
    return NextResponse.redirect(loginUrl)
  }

  const home = token.role === 'ADMIN' ? '/admin/dashboard' : '/employee/dashboard'

  // 4. Logged in
  if (isAuthPage || isLanding) {
    return NextResponse.redirect(new URL(home, nextUrl))
  }
  if (pathname.startsWith('/admin') && token.role !== 'ADMIN') {
    return NextResponse.redirect(new URL(home, nextUrl))
  }
  if (pathname.startsWith('/employee') && token.role !== 'EMPLOYEE') {
    return NextResponse.redirect(new URL(home, nextUrl))
  }

  if (isApi) {
    if (matches(pathname, ADMIN_ONLY_APIS) && token.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }
    if (matches(pathname, EMPLOYEE_ONLY_APIS) && token.role !== 'EMPLOYEE') {
      return NextResponse.json({ error: 'Forbidden: Employee access required' }, { status: 403 })
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|images/|.*\\.(?:jpg|jpeg|png|svg|ico|gif|webp)$).*)',
  ],
}
