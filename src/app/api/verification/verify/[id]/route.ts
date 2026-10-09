import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/api-auth'
import { getClientIp } from '@/lib/ip'
import { isIpAllowed } from '@/lib/clock'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/verification/verify/[id]
 * Employee confirms an active-work check. Must be their own check, still within the
 * time window, and sent from the shop's network (same rule as clock in).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireUser('EMPLOYEE')
  if (guard.response) return guard.response
  const { id: userId, shopId } = guard.user

  try {
    const { id } = await params
    const verification = await prisma.workVerification.findUnique({ where: { id } })

    if (!verification || verification.userId !== userId) {
      return NextResponse.json({ error: 'Verification not found' }, { status: 404 })
    }
    if (verification.status === 'VERIFIED') {
      return NextResponse.json({ status: 'VERIFIED' })
    }
    if (verification.status !== 'PENDING' || new Date() > verification.expiresAt) {
      return NextResponse.json({ error: 'This verification has expired.', status: 'MISSED' }, { status: 410 })
    }

    const shop = shopId ? await prisma.shop.findUnique({ where: { id: shopId } }) : null
    if (!shop || !isIpAllowed(shop.allowedIp, getClientIp(req))) {
      return NextResponse.json(
        { error: 'You must be connected to the shop WiFi to confirm this check.' },
        { status: 403 }
      )
    }

    const updated = await prisma.workVerification.updateMany({
      where: { id, userId, status: 'PENDING', expiresAt: { gt: new Date() } },
      data: { status: 'VERIFIED', verifiedAt: new Date() },
    })
    if (updated.count === 0) {
      return NextResponse.json({ error: 'This verification has expired.', status: 'MISSED' }, { status: 410 })
    }

    return NextResponse.json({ status: 'VERIFIED' })
  } catch (error) {
    console.error('Verify error:', error)
    return NextResponse.json({ error: 'Failed to verify' }, { status: 500 })
  }
}
