import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/api-auth'
import { dbDate, isDateStr } from '@/lib/time'
import { NextResponse } from 'next/server'
import type { Prisma } from '@/generated/prisma/client'

export async function GET(req: Request) {
  const guard = await requireUser('ADMIN')
  if (guard.response) return guard.response

  try {
    const { searchParams } = new URL(req.url)
    const dateStr = searchParams.get('date') // YYYY-MM-DD

    const where: Prisma.DailyAttendanceWhereInput = {}
    if (dateStr) {
      if (!isDateStr(dateStr)) return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
      where.date = dbDate(dateStr) // @db.Date column: exact calendar date match
    }

    const attendanceRecords = await prisma.dailyAttendance.findMany({
      where,
      include: {
        user: { select: { name: true, email: true, shop: { select: { name: true } } } },
      },
      orderBy: { date: 'desc' },
      take: 100
    })

    return NextResponse.json(attendanceRecords)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch attendance records' }, { status: 500 })
  }
}
