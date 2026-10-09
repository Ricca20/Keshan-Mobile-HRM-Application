import type { Settings } from './settings'
import { weeklyOffDays } from './settings'
import { colomboDateStr, addDays, dayOfWeek, dbDateStr, eachDateStr, monthBounds } from './time'

type AttendanceRecord = {
  date: Date
  status: 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'LEAVE'
  isLate: boolean
  lateMinutes: number
  otHours: number
}

type ApprovedLeave = {
  startDate: Date
  endDate: Date
  leaveType: { isPaid: boolean }
}

type PayrollUser = {
  id: string
  salary: number
  joinDate: Date
  penaltyPoints: number
}

/**
 * Calculates one employee's paysheet for a month from their DailyAttendance rows and
 * approved leave. Only days that are already over (up to yesterday, Colombo time) and
 * on/after the join date are evaluated. A past working day with no attendance row and
 * no approved leave counts as absent.
 */
export function calculatePaysheet(
  user: PayrollUser,
  month: number,
  year: number,
  attendance: AttendanceRecord[],
  leaves: ApprovedLeave[],
  settings: Settings
) {
  const { first, last } = monthBounds(month, year)
  const yesterday = addDays(colomboDateStr(), -1)
  const joined = colomboDateStr(user.joinDate)
  const from = joined > first ? joined : first
  const to = yesterday < last ? yesterday : last
  const offDays = weeklyOffDays(settings)

  const byDate = new Map(attendance.map(a => [dbDateStr(a.date), a]))
  const leaveOn = (d: string) =>
    leaves.find(l => dbDateStr(l.startDate) <= d && dbDateStr(l.endDate) >= d)

  const baseSalary = user.salary || 0
  const dailyRate = baseSalary / 30
  const halfDayRate = dailyRate * 0.5

  let paidDays = 0
  let unpaidDays = 0
  let halfDaysTotal = 0
  let lateDays = 0
  let lateMinutesTotal = 0
  let otHoursTotal = 0

  for (const d of from <= to ? eachDateStr(from, to) : []) {
    const record = byDate.get(d)
    const leave = leaveOn(d)

    if (record?.status === 'PRESENT' || record?.status === 'HALF_DAY') {
      if (record.status === 'HALF_DAY') {
        halfDaysTotal += 1
        paidDays += 0.5
      } else {
        paidDays += 1
      }
      if (record.isLate) {
        lateDays += 1
        lateMinutesTotal += record.lateMinutes
      }
      otHoursTotal += record.otHours || 0
    } else if (leave) {
      // LEAVE rows, or ABSENT/missing days later covered by an approved leave
      if (leave.leaveType.isPaid) paidDays += 1
      else unpaidDays += 1
    } else if (record?.status === 'ABSENT' || !offDays.includes(dayOfWeek(d))) {
      unpaidDays += 1
    }
  }

  const unpaidDeduction = unpaidDays * dailyRate
  const halfDayDeduction = halfDaysTotal * halfDayRate
  const lateDeduction = lateDays * settings.LATE_PENALTY_AMOUNT
  const otPay = otHoursTotal * settings.OT_RATE_PER_HOUR

  const penaltyBulks = Math.floor(user.penaltyPoints / settings.PENALTY_THRESHOLD)
  const penaltyDeduction = penaltyBulks * settings.PENALTY_AMOUNT

  const deductions = round2(unpaidDeduction + halfDayDeduction + lateDeduction + penaltyDeduction)

  const notes: string[] = []
  if (unpaidDays > 0) notes.push(`Unpaid/Absent (${unpaidDays} days).`)
  if (halfDaysTotal > 0) notes.push(`Half Days (${halfDaysTotal}).`)
  if (lateDays > 0) notes.push(`Late (${lateDays} days x Rs.${settings.LATE_PENALTY_AMOUNT}).`)
  if (penaltyBulks > 0) notes.push(`Penalty (${user.penaltyPoints} pts = ${penaltyBulks}x Rs.${settings.PENALTY_AMOUNT}).`)

  return {
    userId: user.id,
    month,
    year,
    baseSalary,
    paidDays: Math.ceil(paidDays),
    unpaidDays,
    deductions,
    deductionNote: notes.join(' ') || null,
    bonuses: 0,
    otHoursTotal,
    otPay: round2(otPay),
    lateMinutesTotal,
    lateDeduction: round2(lateDeduction),
    halfDaysTotal,
    halfDayDeduction: round2(halfDayDeduction),
    netPay: calculateNetPay(baseSalary, otPay, deductions, 0),
    status: 'DRAFT' as const,
  }
}

/** Net pay never goes below zero. */
export function calculateNetPay(baseSalary: number, otPay: number, deductions: number, bonuses: number) {
  return Math.max(0, round2(baseSalary + otPay + bonuses - deductions))
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}
