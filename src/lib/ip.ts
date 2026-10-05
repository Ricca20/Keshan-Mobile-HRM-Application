import { NextRequest } from 'next/server'

export function getClientIp(req: NextRequest): string {
  const raw =
    req.headers.get('x-vercel-forwarded-for') ||
    req.headers.get('x-forwarded-for')?.split(',')[0] ||
    req.headers.get('x-real-ip') ||
    '0.0.0.0'

  const ip = raw.trim()

  // Normalize IPv6-mapped IPv4 addresses (e.g. "::ffff:192.168.1.1" → "192.168.1.1")
  if (ip.startsWith('::ffff:')) {
    return ip.slice(7)
  }

  return ip
}
