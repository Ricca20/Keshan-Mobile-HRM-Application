import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// Returns the start and end of today in Asia/Colombo timezone
function getTodayRangeInColombo(): { start: Date; end: Date } {
  const now = new Date()
  // Get today's date string in Colombo timezone (e.g. "2026-10-05")
  const dateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' })
  // Build midnight Colombo = midnight UTC+5:30
  const start = new Date(`${dateStr}T00:00:00+05:30`)
  const end = new Date(`${dateStr}T23:59:59.999+05:30`)
  return { start, end }
}

export async function GET(req: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = (session.user as any).id

  try {
    const { start, end } = getTodayRangeInColombo()

    // Only look at today's valid logs so yesterday's unclosed session doesn't bleed over
    const lastLog = await prisma.clockLog.findFirst({
      where: {
        userId,
        isValid: true,
        timestamp: { gte: start, lte: end },
      },
      orderBy: { timestamp: 'desc' },
    })

    const isClockedIn = lastLog?.type === 'IN'

    return NextResponse.json({
      isClockedIn,
      lastLog,
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 })
  }
}
