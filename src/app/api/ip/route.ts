import { NextRequest, NextResponse } from 'next/server'
import { getClientIp } from '@/lib/ip'
import { requireUser } from '@/lib/api-auth'
import { ipv6Network64 } from '@/lib/clock'

// Used by admins on the shop's WiFi to fill in the shop's allowed IP
export async function GET(req: NextRequest) {
  const guard = await requireUser('ADMIN')
  if (guard.response) return guard.response

  const ip = getClientIp(req)
  // IPv6 phones rotate their address, so suggest the shop's whole /64 network instead
  return NextResponse.json({ ip, rule: ipv6Network64(ip) ?? ip })
}
