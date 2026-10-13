import { prisma } from '@/lib/prisma'
import { requireUser, readJson } from '@/lib/api-auth'
import { dateStrSchema, validate } from '@/lib/validation'
import { evaluateWorkedDay, processDailyAttendance } from '@/lib/attendance'
import { getSettings } from '@/lib/settings'
import { colomboDateStr, colomboTime, dbDate, dbDateStr, isDateStr, isTimeStr } from '@/lib/time'
import { NextResponse } from 'next/server'
import { z } from 'zod'
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

    // Attach each day's lunch break
    const lunches = await prisma.lunchBreak.findMany({
      where: {
        userId: { in: [...new Set(attendanceRecords.map(r => r.userId))] },
        date: { in: [...new Set(attendanceRecords.map(r => r.date.getTime()))].map(t => new Date(t)) },
      },
      select: { userId: true, date: true, startedAt: true, dueAt: true, endedAt: true, isOverdue: true },
    })
    const lunchByDay = new Map(lunches.map(l => [`${l.userId}|${dbDateStr(l.date)}`, l]))

    return NextResponse.json(attendanceRecords.map(r => {
      const lunch = lunchByDay.get(`${r.userId}|${dbDateStr(r.date)}`)
      return { ...r, lunch: lunch ? { startedAt: lunch.startedAt, dueAt: lunch.dueAt, endedAt: lunch.endedAt, isOverdue: lunch.isOverdue } : null }
    }))
  } catch {
    return NextResponse.json({ error: 'Failed to fetch attendance records' }, { status: 500 })
  }
}

const timeSchema = z.string().refine(isTimeStr, 'Times must be HH:mm').nullable().optional()

const overrideSchema = z.object({
  userId: z.string().min(1).max(100),
  date: dateStrSchema,
  status: z.enum(['PRESENT', 'HALF_DAY', 'ABSENT', 'LEAVE']),
  clockIn: timeSchema,
  clockOut: timeSchema,
  note: z.string().trim().min(3, 'Please give a reason for the correction').max(500),
})

const resetSchema = z.object({
  userId: z.string().min(1).max(100),
  date: dateStrSchema,
})

/**
 * PUT /api/hrms/attendance
 * Admin corrects one employee's attendance for one day. Late/OT are recalculated from
 * the entered times with the normal rules; the chosen status is final. The row is marked
 * with `updatedBy`, so automatic reprocessing leaves it alone until it is reset.
 */
export async function PUT(req: Request) {
  const guard = await requireUser('ADMIN')
  if (guard.response) return guard.response

  const validation = validate(overrideSchema, await readJson(req))
  if (!validation.success) return validation.response
  const { userId, date, status, note } = validation.data

  if (date > colomboDateStr()) {
    return NextResponse.json({ error: 'Attendance cannot be set for a future date' }, { status: 400 })
  }

  const worked = status === 'PRESENT' || status === 'HALF_DAY'
  const clockIn = worked && validation.data.clockIn ? colomboTime(date, validation.data.clockIn) : undefined
  const clockOut = worked && validation.data.clockOut ? colomboTime(date, validation.data.clockOut) : undefined

  if (worked && !clockIn) {
    return NextResponse.json({ error: 'Time in is required for Present or Half Day' }, { status: 400 })
  }
  if (clockIn && clockOut && clockOut <= clockIn) {
    return NextResponse.json({ error: 'Time out must be after time in' }, { status: 400 })
  }

  try {
    const employee = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
    if (!employee || employee.role !== 'EMPLOYEE') {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    const flags = worked
      ? evaluateWorkedDay(date, clockIn, clockOut, await getSettings())
      : { isLate: false, lateMinutes: 0, otHours: 0 }

    const data = {
      status,
      clockIn: clockIn ?? null,
      clockOut: clockOut ?? null,
      isLate: flags.isLate,
      lateMinutes: flags.lateMinutes,
      otHours: flags.otHours,
      isHalfDay: status === 'HALF_DAY',
      overrideNote: note,
      updatedBy: guard.user.id,
    }

    const record = await prisma.dailyAttendance.upsert({
      where: { userId_date: { userId, date: dbDate(date) } },
      create: { userId, date: dbDate(date), ...data },
      update: data,
    })

    return NextResponse.json(record)
  } catch (error) {
    console.error('Attendance override error:', error)
    return NextResponse.json({ error: 'Failed to update attendance' }, { status: 500 })
  }
}

/**
 * DELETE /api/hrms/attendance
 * Removes an admin correction and recalculates the day from the clock logs.
 */
export async function DELETE(req: Request) {
  const guard = await requireUser('ADMIN')
  if (guard.response) return guard.response

  const validation = validate(resetSchema, await readJson(req))
  if (!validation.success) return validation.response
  const { userId, date } = validation.data

  try {
    await prisma.dailyAttendance.deleteMany({ where: { userId, date: dbDate(date) } })
    const record = await processDailyAttendance(userId, colomboTime(date, '12:00'))
    return NextResponse.json(record)
  } catch (error) {
    console.error('Attendance reset error:', error)
    return NextResponse.json({ error: 'Failed to reset attendance' }, { status: 500 })
  }
}
