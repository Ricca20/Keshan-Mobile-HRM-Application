import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/api-auth'
import { NextResponse } from 'next/server'

/**
 * Confirms the penalty for a MISSED verification. The penalty point itself was already
 * added automatically when the verification expired, so this does not add another one.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireUser('ADMIN')
  if (guard.response) return guard.response

  try {
    const { id } = await params

    const verification = await prisma.workVerification.findUnique({ where: { id } })
    if (!verification) {
      return NextResponse.json({ error: 'Verification not found' }, { status: 404 })
    }

    const updated = await prisma.workVerification.updateMany({
      where: { id, status: 'MISSED' },
      data: { status: 'PENALIZED' },
    })
    if (updated.count === 0) {
      return NextResponse.json({ error: 'Only missed verifications can be penalized' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id: verification.userId },
      select: { penaltyPoints: true },
    })

    await prisma.notification.create({
      data: {
        userId: verification.userId,
        title: 'Penalty Assigned',
        message: 'A penalty point was recorded for missing a work verification check.',
        type: 'PAYROLL'
      }
    })

    return NextResponse.json({ success: true, points: user?.penaltyPoints ?? 0 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to penalize' }, { status: 500 })
  }
}
