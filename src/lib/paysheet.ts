import { prisma } from './prisma'
import { getDaysInMonth, eachDayOfInterval } from 'date-fns'
import { processDailyAttendance, getSetting } from './attendance'

/**
 * Calculates the number of valid clocked days for a user in a given month.
 */
async function countValidClockDays(userId: string, month: number, year: number): Promise<number> {
  const startOfMonth = new Date(year, month - 1, 1)
  const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999)

  // Get all valid clock-ins for the month
  const clockIns = await prisma.clockLog.findMany({
    where: {
      userId,
      type: 'IN',
      isValid: true,
      timestamp: {
        gte: startOfMonth,
        lte: endOfMonth
      }
    },
    select: { timestamp: true }
  })

  // To count unique days, format timestamp to YYYY-MM-DD and add to a Set
  const uniqueDays = new Set(
    clockIns.map(log => log.timestamp.toISOString().split('T')[0])
  )

  return uniqueDays.size
}

/**
 * Generates the paysheet data for an employee for a specific month.
 * This does NOT save it to the DB; it returns the calculated object.
 */
export async function generatePaySheetData(userId: string, month: number, year: number) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new Error(`User ${userId} not found`)

  const startOfMonth = new Date(year, month - 1, 1)
  const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999)

  // As per client preference, working days = total days in the month
  const workingDays = getDaysInMonth(startOfMonth)

  // Get HRMS Settings
  const otRate = parseFloat(await getSetting('OT_RATE_PER_HOUR', '1000'))
  const latePenaltyAmount = parseFloat(await getSetting('LATE_PENALTY_AMOUNT', '500'))

  // Process all attendance days for this user in this month
  const daysInMonth = eachDayOfInterval({ start: startOfMonth, end: endOfMonth })
  const attendanceRecords = await Promise.all(
    daysInMonth.map(date => processDailyAttendance(userId, date))
  )

  let paidDays = 0
  let unpaidDays = 0
  
  let otHoursTotal = 0
  let otPay = 0
  
  let lateMinutesTotal = 0
  let lateDeduction = 0
  
  let halfDaysTotal = 0
  let halfDayDeduction = 0

  const dailyRate = user.salary / workingDays

  for (const record of attendanceRecords) {
     if (record.status === 'PRESENT') {
        paidDays += 1
     } else if (record.status === 'HALF_DAY') {
        paidDays += 0.5
        halfDaysTotal += 1
        halfDayDeduction += (dailyRate * 0.5) // Deduct half a day
     } else if (record.status === 'LEAVE') {
        // Is it paid or unpaid? We have to check the LeaveRequest
        const leave = await prisma.leaveRequest.findFirst({
           where: {
              userId,
              status: 'APPROVED',
              startDate: { lte: record.date },
              endDate: { gte: record.date }
           },
           include: { leaveType: true }
        })
        if (leave?.leaveType.isPaid) {
           paidDays += 1
        } else {
           unpaidDays += 1
        }
     } else if (record.status === 'ABSENT') {
        unpaidDays += 1
     }

     if (record.isLate) {
        lateMinutesTotal += record.lateMinutes
        lateDeduction += latePenaltyAmount // Fixed deduction per late day
     }

     if (record.otHours > 0) {
        otHoursTotal += record.otHours
        otPay += (record.otHours * otRate)
     }
  }

  // Deduct for absences
  const deductionFromUnpaid = unpaidDays * dailyRate

  // Penalty Calculation: Deduct a base amount per 10 points (can be overridden by admin later)
  const penaltySets = Math.floor(user.penaltyPoints / 10)
  const penaltyDeduction = penaltySets * 1000 // 1000 deduction per 10 points

  const totalDeductions = deductionFromUnpaid + lateDeduction + halfDayDeduction + penaltyDeduction
  const totalBonuses = otPay
  
  const netPay = user.salary + totalBonuses - totalDeductions

  let deductionNote = ''
  if (penaltyDeduction > 0) {
    deductionNote = `Salary cut for ${user.penaltyPoints} Penalty Points. `
  }
  if (lateDeduction > 0) {
    deductionNote += `Late Deduction: ${lateDeduction}. `
  }
  if (halfDayDeduction > 0) {
    deductionNote += `Half-day Deduction: ${halfDayDeduction}. `
  }
  
  let bonusNote = ''
  if (otPay > 0) {
    bonusNote = `OT Pay: ${otPay} for ${otHoursTotal} hours.`
  }

  return {
    userId,
    month,
    year,
    baseSalary: user.salary,
    paidDays,
    unpaidDays,
    deductions: totalDeductions,
    deductionNote: deductionNote.trim() || null,
    bonuses: totalBonuses,
    bonusNote: bonusNote || null,
    otHoursTotal,
    otPay,
    lateMinutesTotal,
    lateDeduction,
    halfDaysTotal,
    halfDayDeduction,
    netPay,
    status: 'DRAFT' as const
  }
}
