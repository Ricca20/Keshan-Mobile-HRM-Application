import { NextRequest, NextResponse } from 'next/server'
import { getClientIp } from '@/lib/ip'

export async function GET(req: NextRequest) {
  const ip = getClientIp(req)
  return NextResponse.json({ ip })
}
