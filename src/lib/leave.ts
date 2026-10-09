import { prisma } from './prisma'
import { dayOfWeek, eachDateStr } from './time'

/**
 * Counts leave days between two calendar dates (inclusive), skipping the shop's
 * weekly off days (WEEKLY_OFF_DAYS setting).
 */
export function calculateLeaveDays(startStr: string, endStr: string, offDays: number[]): number {
  return eachDateStr(startStr, endStr).filter(d => !offDays.includes(dayOfWeek(d))).length
}

/**
 * Ensures every active employee has a LeaveBalance for the given leave type this year.
 * Existing balances are left untouched.
 */
export async function syncLeaveBalances(leaveTypeId: string, daysAllowed: number) {
  const currentYear = new Date().getFullYear()

  const employees = await prisma.user.findMany({
    where: { isActive: true, role: 'EMPLOYEE' },
    select: { id: true }
  })

  await prisma.leaveBalance.createMany({
    data: employees.map(emp => ({
      userId: emp.id,
      leaveTypeId,
      year: currentYear,
      totalDays: daysAllowed,
      usedDays: 0,
    })),
    skipDuplicates: true,
  })
}

/** Creates this year's balances for one employee for every active leave type. */
export async function createBalancesForEmployee(userId: string) {
  const currentYear = new Date().getFullYear()
  const leaveTypes = await prisma.leaveType.findMany({ where: { isActive: true } })

  await prisma.leaveBalance.createMany({
    data: leaveTypes.map(lt => ({
      userId,
      leaveTypeId: lt.id,
      year: currentYear,
      totalDays: lt.daysAllowed,
      usedDays: 0,
    })),
    skipDuplicates: true,
  })
}
