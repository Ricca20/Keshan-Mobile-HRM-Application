import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/cron'
import { expireVerifications, VERIFICATION_WINDOW_MS } from '@/lib/verification'
import { AUTO_CLOSED_REASON } from '@/lib/clock'

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // 1. Expire old pending verifications (adds penalty points)
    const processed = await expireVerifications()

    // 2. Randomly trigger new verifications for clocked-in users
    const users = await prisma.user.findMany({
      where: { role: 'EMPLOYEE', isActive: true },
      select: {
        id: true,
        clockLogs: {
          where: { OR: [{ isValid: true }, { flagReason: AUTO_CLOSED_REASON }] },
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
      },
    })

    const clockedInUsers = users.filter(u => u.clockLogs[0]?.type === 'IN')
    const now = Date.now()

    for (const user of clockedInUsers) {
      // 30% chance to trigger a check
      if (Math.random() < 0.3) {
        await prisma.workVerification.create({
          data: { userId: user.id, expiresAt: new Date(now + VERIFICATION_WINDOW_MS) },
        })
      }
    }

    return NextResponse.json({ success: true, processed, checked: clockedInUsers.length })
  } catch (error) {
    console.error('Cron Error:', error)
    return NextResponse.json({ error: 'Failed to process verifications' }, { status: 500 })
  }
}
