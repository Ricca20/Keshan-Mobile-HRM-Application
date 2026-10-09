import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/api-auth'
import { colomboDayRange, isDateStr } from '@/lib/time'
import { NextResponse } from 'next/server'
import type { Prisma } from '@/generated/prisma/client'

export async function GET(req: Request) {
  const guard = await requireUser('ADMIN')
  if (guard.response) return guard.response

  try {
    const { searchParams } = new URL(req.url)
    const dateStr = searchParams.get('date') // YYYY-MM-DD (Colombo)

    const where: Prisma.ClockLogWhereInput = {}
    if (dateStr) {
      if (!isDateStr(dateStr)) return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
      const { start, end } = colomboDayRange(dateStr)
      where.timestamp = { gte: start, lte: end }
    }

    const logs = await prisma.clockLog.findMany({
      where,
      include: {
        user: { select: { name: true, email: true } },
        shop: { select: { name: true } },
      },
      orderBy: { timestamp: 'desc' },
      take: 100 // Limit to recent 100 logs for performance
    })

    return NextResponse.json(logs)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch clock logs' }, { status: 500 })
  }
}
