import { prisma } from './prisma'
import { differenceInMinutes, differenceInHours, parse } from 'date-fns'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'

const TZ = 'Asia/Colombo'

export async function getSetting(key: string, defaultValue: string) {
  const setting = await prisma.systemSetting.findUnique({ where: { key } })
  return setting?.value || defaultValue
}

export async function processDailyAttendance(userId: string, date: Date) {
  // 1. Fetch settings
  const shiftStartTimeStr = await getSetting('SHIFT_START_TIME', '09:00')
  const shiftEndTimeStr = await getSetting('SHIFT_END_TIME', '18:00')
  const lateGraceMins = parseInt(await getSetting('LATE_GRACE_PERIOD_MINS', '15'))
  const maxLateForHalfDay = parseInt(await getSetting('MAX_LATE_MINS_FOR_HALF_DAY', '60'))
  const minHoursForFullDay = parseInt(await getSetting('MIN_HOURS_FOR_FULL_DAY', '4'))
  
  // 2. Get today's date in Asia/Colombo timezone
  // e.g. if UTC is 2026-10-04 18:31 → Colombo is 2026-10-05 00:01
  const dateStr = date.toLocaleDateString('en-CA', { timeZone: TZ }) // 'YYYY-MM-DD'
  // Build midnight Colombo as UTC for DB range queries
  const start = fromZonedTime(`${dateStr}T00:00:00`, TZ)
  const end = fromZonedTime(`${dateStr}T23:59:59.999`, TZ)
  // Use start as the canonical "date" key for DailyAttendance (stored as @db.Date)
  const attendanceDate = new Date(`${dateStr}T00:00:00.000Z`)

  const logs = await prisma.clockLog.findMany({
    where: {
      userId,
      timestamp: { gte: start, lte: end },
      isValid: true,
    },
    orderBy: { timestamp: 'asc' }
  })


  // 3. Process logs
  if (logs.length === 0) {
     // No valid logs. Check if they are on leave.
     const leaves = await prisma.leaveRequest.findFirst({
        where: {
           userId,
           status: 'APPROVED',
           startDate: { lte: start },
           endDate: { gte: start }
        }
     })
     const status = leaves ? 'LEAVE' : 'ABSENT'
     
     return prisma.dailyAttendance.upsert({
        where: { userId_date: { userId, date: attendanceDate } },
        create: { userId, date: attendanceDate, status },
        update: { status, clockIn: null, clockOut: null, isLate: false, isHalfDay: false, otHours: 0, lateMinutes: 0 }
     })
  }

  // They have logs
  const firstIn = logs.find(l => l.type === 'IN')?.timestamp
  const lastOut = [...logs].reverse().find(l => l.type === 'OUT')?.timestamp

  let isLate = false
  let lateMinutes = 0
  let isHalfDay = false
  let otHours = 0
  
  // Parse shift times relative to the Colombo midnight reference point
  // e.g. '09:00' → 09:00 Colombo time (which is UTC+5:30)
  const colomboMidnight = fromZonedTime(`${dateStr}T00:00:00`, TZ)
  const shiftStart = parse(shiftStartTimeStr, 'HH:mm', colomboMidnight)
  const shiftEnd = parse(shiftEndTimeStr, 'HH:mm', colomboMidnight)

  if (firstIn) {
     const diffMins = differenceInMinutes(firstIn, shiftStart)
     if (diffMins > lateGraceMins) {
        isLate = true
        lateMinutes = diffMins
        if (lateMinutes > maxLateForHalfDay) {
           isHalfDay = true
        }
     }
  }

  if (firstIn && lastOut) {
     const workedHours = differenceInHours(lastOut, firstIn)
     if (workedHours < minHoursForFullDay) {
        isHalfDay = true
     }

     const otMins = differenceInMinutes(lastOut, shiftEnd)
     if (otMins > 30) {
        // give OT in hours, rounded down to nearest 0.5 or 1? Let's just do exact 0.5 increments
        otHours = Math.floor(otMins / 30) * 0.5
     }
  } else {
     // Missing clock out, treat as half day as penalty, or they forgot.
     isHalfDay = true
  }

  // If already flagged as half day, status is HALF_DAY, else PRESENT
  const status = isHalfDay ? 'HALF_DAY' : 'PRESENT'

  return prisma.dailyAttendance.upsert({
     where: { userId_date: { userId, date: attendanceDate } },
     create: {
        userId, date: attendanceDate, clockIn: firstIn, clockOut: lastOut,
        status, isLate, lateMinutes, isHalfDay, otHours
     },
     update: {
        clockIn: firstIn, clockOut: lastOut,
        status, isLate, lateMinutes, isHalfDay, otHours
     }
  })
}
