import { prisma } from './prisma'
import { colomboYear, dayOfWeek, eachDateStr } from './time'

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
  const currentYear = colomboYear()

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

/**
 * Creates a year's balance for every active employee and active leave type that doesn't
 * have one. Idempotent; run daily so a new year never starts without balances.
 */
export async function ensureYearBalances(year: number = colomboYear()): Promise<number> {
  const [employees, leaveTypes] = await Promise.all([
    prisma.user.findMany({ where: { isActive: true, role: 'EMPLOYEE' }, select: { id: true } }),
    prisma.leaveType.findMany({ where: { isActive: true } }),
  ])

  const { count } = await prisma.leaveBalance.createMany({
    data: employees.flatMap(user => leaveTypes.map(leaveType => ({
      userId: user.id,
      leaveTypeId: leaveType.id,
      year,
      totalDays: leaveType.daysAllowed,
      usedDays: 0,
    }))),
    skipDuplicates: true,
  })
  return count
}

/** Creates a year's balances (default: this year) for one employee for every active leave type. */
export async function createBalancesForEmployee(userId: string, year: number = colomboYear()) {
  const leaveTypes = await prisma.leaveType.findMany({ where: { isActive: true } })

  await prisma.leaveBalance.createMany({
    data: leaveTypes.map(lt => ({
      userId,
      leaveTypeId: lt.id,
      year,
      totalDays: lt.daysAllowed,
      usedDays: 0,
    })),
    skipDuplicates: true,
  })
}
