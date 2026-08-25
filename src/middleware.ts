import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Basic memory store for rate limiting (since we don't have Redis)
const rateLimitMap = new Map<string, { count: number, resetTime: number }>()
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const MAX_REQUESTS = 10 // Max login attempts per minute

export async function middleware(req: NextRequest) {
  // 1. Rate Limiting for Login & Forgot Password
  if ((req.nextUrl.pathname === '/login' || req.nextUrl.pathname === '/api/auth/forgot-password') && req.method === 'POST') {
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1'
    const now = Date.now()
    
    const limitRecord = rateLimitMap.get(ip)
    if (limitRecord) {
      if (now > limitRecord.resetTime) {
        rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
      } else {
        if (limitRecord.count >= MAX_REQUESTS) {
          return new NextResponse('Too many requests, please try again later.', { status: 429 })
        }
        limitRecord.count++
      }
    } else {
      rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    }
  }

  const { nextUrl } = req
  const isProduction = process.env.NODE_ENV === 'production'
  const token = await getToken({ 
    req, 
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || '',
    secureCookie: isProduction,
    salt: isProduction ? '__Secure-authjs.session-token' : 'authjs.session-token'
  })

  const isLoggedIn = !!token
  const isAuthRoute = nextUrl.pathname.startsWith('/login')
  const isAdminRoute = nextUrl.pathname.startsWith('/admin')
  const isEmployeeRoute = nextUrl.pathname.startsWith('/employee')

  // Allow static assets, images, and API auth routes
  if (
    nextUrl.pathname.startsWith('/api/auth') ||
    nextUrl.pathname.startsWith('/api/test-db') ||
    nextUrl.pathname.startsWith('/_next') ||
    nextUrl.pathname.match(/\.(jpg|jpeg|png|svg|ico|gif|webp)$/i)
  ) {
    return NextResponse.next()
  }

  // Redirect unauthenticated users to login (except if already on login page)
  if (!isLoggedIn && !isAuthRoute) {
    return NextResponse.redirect(new URL('/login', nextUrl))
  }

  // Allow NextAuth routes to pass through (forgot-password is rate limited above)
  if (nextUrl.pathname.startsWith('/api/auth/callback') || nextUrl.pathname.startsWith('/api/auth/session') || nextUrl.pathname.startsWith('/api/auth/csrf') || nextUrl.pathname.startsWith('/api/auth/providers') || nextUrl.pathname.startsWith('/api/auth/signin') || nextUrl.pathname.startsWith('/api/auth/signout')) {
    return NextResponse.next()
  }

  // Handle Logged In Users
  if (isLoggedIn) {
    if (isAuthRoute || nextUrl.pathname === '/') {
      return NextResponse.redirect(new URL(token.role === 'ADMIN' ? '/admin/dashboard' : '/employee/dashboard', nextUrl))
    }
    
    if (isAdminRoute && token.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/employee/dashboard', nextUrl))
    }
    
    if (isEmployeeRoute && token.role !== 'EMPLOYEE') {
      return NextResponse.redirect(new URL('/admin/dashboard', nextUrl))
    }

    // Strict API Route Validation
    if (nextUrl.pathname.startsWith('/api')) {
      const adminOnlyApis = ['/api/employees', '/api/shops', '/api/paysheets/generate', '/api/paysheets/finalize', '/api/paysheets/export', '/api/leave/types', '/api/verification/send', '/api/verification/penalize']
      const employeeOnlyApis = ['/api/clock/in', '/api/clock/out', '/api/verification/check']

      const isAdminApi = adminOnlyApis.some(route => nextUrl.pathname.startsWith(route))
      const isEmployeeApi = employeeOnlyApis.some(route => nextUrl.pathname.startsWith(route))

      if (isAdminApi && token.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
      }
      if (isEmployeeApi && token.role !== 'EMPLOYEE') {
        return NextResponse.json({ error: 'Forbidden: Employee access required' }, { status: 403 })
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
}
