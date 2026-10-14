import { prisma } from './prisma'
import { getSettings, weeklyOffDays, type Settings } from './settings'
import {
  colomboDateStr,
  colomboDayRange,
  colomboTime,
  dayOfWeek,
  dbDate,
} from './time'

const MINUTE = 60 * 1000

/**
 * Recomputes the DailyAttendance row for one employee on one Colombo calendar day.
 * Returns null for a weekly off day with no clock activity (no row is kept).
 */
export async function processDailyAttendance(userId: string, date: Date, settings?: Settings) {
  const s = settings ?? (await getSettings())

  const dateStr = colomboDateStr(date)
  const { start, end } = colomboDayRange(dateStr)
  const attendanceDate = dbDate(dateStr) // key for the @db.Date column
  const key = { userId_date: { userId, date: attendanceDate } }

  // A record an admin corrected by hand is kept as is until the admin resets it
  const existing = await prisma.dailyAttendance.findUnique({ where: key })
  if (existing?.updatedBy) return existing

  const logs = await prisma.clockLog.findMany({
    where: { userId, timestamp: { gte: start, lte: end }, isValid: true },
    orderBy: { timestamp: 'asc' },
  })

  if (logs.length === 0) {
    // Leave dates are @db.Date values, so compare against the calendar date itself
    const leave = await prisma.leaveRequest.findFirst({
      where: {
        userId,
        status: 'APPROVED',
        startDate: { lte: attendanceDate },
        endDate: { gte: attendanceDate },
      },
    })

    if (!leave && weeklyOffDays(s).includes(dayOfWeek(dateStr))) {
      await prisma.dailyAttendance.deleteMany({ where: { userId, date: attendanceDate } })
      return null
    }

    const status = leave ? 'LEAVE' : 'ABSENT'
    return prisma.dailyAttendance.upsert({
      where: key,
      create: { userId, date: attendanceDate, status },
      update: { status, clockIn: null, clockOut: null, isLate: false, isHalfDay: false, otHours: 0, lateMinutes: 0 },
    })
  }

  const firstIn = logs.find(l => l.type === 'IN')?.timestamp
  // If the day's latest entry is a clock-in, that shift is still open (or was never
  // closed), so an earlier clock-out is not the end of the working day.
  const lastLog = logs[logs.length - 1]
  const lastOut = lastLog.type === 'OUT' ? lastLog.timestamp : undefined

  const { isLate, lateMinutes, isHalfDay, otHours } = evaluateWorkedDay(dateStr, firstIn, lastOut, s)

  const status = isHalfDay ? 'HALF_DAY' : 'PRESENT'

  return prisma.dailyAttendance.upsert({
    where: key,
    create: {
      userId, date: attendanceDate, clockIn: firstIn, clockOut: lastOut,
      status, isLate, lateMinutes, isHalfDay, otHours,
    },
    update: {
      clockIn: firstIn ?? null, clockOut: lastOut ?? null,
      status, isLate, lateMinutes, isHalfDay, otHours,
    },
  })
}

/**
 * Late / half-day / OT rules for one Colombo calendar day, given the first clock-in
 * and last clock-out. Shared by automatic processing and admin corrections.
 */
export function evaluateWorkedDay(
  dateStr: string,
  firstIn: Date | undefined,
  lastOut: Date | undefined,
  s: Settings
) {
  let isLate = false
  let lateMinutes = 0
  let isHalfDay = false
  let otHours = 0

  // Shift times are Colombo wall-clock times on this calendar day
  const shiftStart = colomboTime(dateStr, s.SHIFT_START_TIME)
  const shiftEnd = colomboTime(dateStr, s.SHIFT_END_TIME)

  if (firstIn) {
    const diffMins = Math.floor((firstIn.getTime() - shiftStart.getTime()) / MINUTE)
    if (diffMins > s.LATE_GRACE_PERIOD_MINS) {
      isLate = true
      lateMinutes = diffMins
      if (lateMinutes > s.MAX_LATE_MINS_FOR_HALF_DAY) {
        isHalfDay = true
      }
    }
  }

  if (firstIn && lastOut && lastOut > firstIn) {
    const workedHours = (lastOut.getTime() - firstIn.getTime()) / (60 * MINUTE)
    if (workedHours < s.MIN_HOURS_FOR_FULL_DAY) {
      isHalfDay = true
    }

    const otMins = Math.floor((lastOut.getTime() - shiftEnd.getTime()) / MINUTE)
    if (otMins > 30) {
      // OT in 0.5 hour increments
      otHours = Math.floor(otMins / 30) * 0.5
    }
  } else if (dateStr !== colomboDateStr()) {
    // Day is over without a valid clock-out: treat as half day.
    // (While the day is still running the employee may simply not have clocked out yet.)
    isHalfDay = true
  }

  return { isLate, lateMinutes, isHalfDay, otHours }
}
