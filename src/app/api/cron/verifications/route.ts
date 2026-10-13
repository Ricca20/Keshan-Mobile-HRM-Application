import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/cron'
import { expireVerifications, sendVerificationEmail, VERIFICATION_WINDOW_MS } from '@/lib/verification'
import { AUTO_CLOSED_REASON } from '@/lib/clock'
import { colomboDateStr, colomboDayRange } from '@/lib/time'
import { expireLunches } from '@/lib/lunch'

// Triggered every 10 minutes during shop hours (07:30-21:30) by .github/workflows/verification-pings.yml
// (Vercel Hobby only allows daily crons). Over a 9-hour shift that is ~54 runs, so an
// 8% chance with a daily cap gives each clocked-in employee a few random checks a day.
// The same run also penalizes overdue lunch breaks.
const PING_CHANCE = 0.08
const MAX_PINGS_PER_DAY = 3

// Loops over every employee; give it room beyond the default function timeout
export const maxDuration = 60

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // 1. Expire old pending verifications (adds penalty points)
    const processed = await expireVerifications()
    const overdueLunches = await expireLunches()

    // 2. Randomly trigger new verifications for clocked-in users
    const users = await prisma.user.findMany({
      where: { role: 'EMPLOYEE', isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        clockLogs: {
          where: { OR: [{ isValid: true }, { flagReason: AUTO_CLOSED_REASON }] },
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
      },
    })

    const clockedInUsers = users.filter(u => u.clockLogs[0]?.type === 'IN')
    const now = Date.now()
    const { start: todayStart } = colomboDayRange(colomboDateStr())

    let sent = 0
    for (const user of clockedInUsers) {
      if (Math.random() >= PING_CHANCE) continue

      const [pending, sentToday] = await Promise.all([
        prisma.workVerification.count({ where: { userId: user.id, status: 'PENDING' } }),
        prisma.workVerification.count({ where: { userId: user.id, sentAt: { gte: todayStart } } }),
      ])
      if (pending > 0 || sentToday >= MAX_PINGS_PER_DAY) continue

      const verification = await prisma.workVerification.create({
        data: { userId: user.id, expiresAt: new Date(now + VERIFICATION_WINDOW_MS) },
      })
      await sendVerificationEmail(user, verification.id, 'You have been selected for a random active work verification check.')
      sent++
    }

    return NextResponse.json({ success: true, processed, overdueLunches, checked: clockedInUsers.length, sent })
  } catch (error) {
    console.error('Cron Error:', error)
    return NextResponse.json({ error: 'Failed to process verifications' }, { status: 500 })
  }
}
