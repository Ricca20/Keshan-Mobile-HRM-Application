import { NextRequest, NextResponse } from 'next/server'
import { getClientIp } from '@/lib/ip'
import { requireUser } from '@/lib/api-auth'

// Used by admins on the shop's WiFi to fill in the shop's allowed IP
export async function GET(req: NextRequest) {
  const guard = await requireUser('ADMIN')
  if (guard.response) return guard.response

  return NextResponse.json({ ip: getClientIp(req) })
}
