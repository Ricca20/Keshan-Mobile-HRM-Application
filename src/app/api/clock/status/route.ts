import { prisma } from '@/lib/prisma'
import { lastShiftLog } from '@/lib/clock'
import { requireUser } from '@/lib/api-auth'
import { colomboDateStr, colomboDayRange } from '@/lib/time'
import { expireLunches, todaysLunch } from '@/lib/lunch'
import { getSettings } from '@/lib/settings'
import { NextResponse } from 'next/server'

export async function GET() {
  const guard = await requireUser()
  if (guard.response) return guard.response
  const userId = guard.user.id

  try {
    // Same rule clock in/out uses, so the button always matches what the API will accept
    const last = await lastShiftLog(userId)
    const isClockedIn = last?.type === 'IN'

    const { start, end } = colomboDayRange(colomboDateStr())
    const lastLog = isClockedIn
      ? last
      : await prisma.clockLog.findFirst({
          where: { userId, isValid: true, timestamp: { gte: start, lte: end } },
          orderBy: { timestamp: 'desc' },
        })

    // Penalize this employee's lunch right away if it just ran out
    await expireLunches(userId)
    const [lunch, settings] = await Promise.all([todaysLunch(userId), getSettings()])

    return NextResponse.json({
      isClockedIn,
      lastLog,
      lunch: lunch && {
        startedAt: lunch.startedAt,
        dueAt: lunch.dueAt,
        endedAt: lunch.endedAt,
        isOverdue: lunch.isOverdue,
      },
      lunchMinutes: settings.LUNCH_DURATION_MINS,
      serverTime: new Date(),
    })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 })
  }
}
