import { getClientIp } from '@/lib/ip'
import { endLunch } from '@/lib/lunch'
import { requireUser } from '@/lib/api-auth'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const guard = await requireUser('EMPLOYEE')
  if (guard.response) return guard.response
  const { id: userId, shopId } = guard.user

  if (!shopId) {
    return NextResponse.json({ error: 'You are not assigned to a shop. Please contact your admin.' }, { status: 403 })
  }

  try {
    const result = await endLunch(userId, shopId, getClientIp(req))
    return NextResponse.json(result.body, { status: result.status })
  } catch (error) {
    console.error('[Lunch OUT] failed:', error)
    return NextResponse.json({ error: 'Failed to end lunch break. Please try again.' }, { status: 500 })
  }
}
