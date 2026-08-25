import { prisma } from './prisma'

/**
 * Calculates the total number of leave days between two dates.
 * Since this is a retail phone shop, we include weekends.
 * @param startDate Start date of the leave
 * @param endDate End date of the leave
 * @returns Total number of days
 */
export function calculateLeaveDays(startDate: Date, endDate: Date): number {
  let count = 0
  const curDate = new Date(startDate.getTime())
  
  while (curDate <= endDate) {
    const dayOfWeek = curDate.getDay()
    // Skip Sundays (0) and Saturdays (6)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++
    }
    curDate.setDate(curDate.getDate() + 1)
  }
  
  return count
}

/**
 * Syncs LeaveBalance records for all active employees for a given leave type.
 * Used when a new LeaveType is created or when needing to ensure everyone has a balance.
 * @param leaveTypeId ID of the LeaveType
 * @param daysAllowed Number of days allowed per year
 */
export async function syncLeaveBalances(leaveTypeId: string, daysAllowed: number) {
  const currentYear = new Date().getFullYear()

  // Get all active employees
  const employees = await prisma.user.findMany({
    where: { isActive: true, role: 'EMPLOYEE' },
    select: { id: true }
  })

  // Upsert a LeaveBalance for each employee for the current year
  for (const emp of employees) {
    await prisma.leaveBalance.upsert({
      where: {
        userId_leaveTypeId_year: {
          userId: emp.id,
          leaveTypeId,
          year: currentYear
        }
      },
      create: {
        userId: emp.id,
        leaveTypeId,
        year: currentYear,
        totalDays: daysAllowed,
        usedDays: 0
      },
      update: {
        // We do not change usedDays or totalDays on sync, 
        // to avoid overwriting existing data. 
        // If daysAllowed changes, we might want to update totalDays, 
        // but for now we'll just ensure the record exists.
      }
    })
  }
}
