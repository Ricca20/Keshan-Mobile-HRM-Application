import { prisma } from './src/lib/prisma'

async function main() {
  const today = new Date()
  const startOfDay = new Date(today.setHours(0, 0, 0, 0))
  const endOfDay = new Date(today.setHours(23, 59, 59, 999))
  const currentMonth = today.getMonth() + 1
  const currentYear = today.getFullYear()

  try {
    const result = await Promise.all([
      prisma.user.count({ where: { role: 'EMPLOYEE', isActive: true } }),
      prisma.clockLog.findMany({
        where: { type: 'IN', timestamp: { gte: startOfDay, lte: endOfDay } },
        distinct: ['userId']
      }),
      prisma.leaveRequest.count({ where: { status: 'PENDING' } }),
      prisma.clockLog.count({
        where: { isValid: false, timestamp: { gte: startOfDay, lte: endOfDay } }
      }),
      prisma.paySheet.count({
        where: { status: 'DRAFT', month: currentMonth, year: currentYear }
      }),
      prisma.leaveRequest.findMany({
        where: { status: 'APPROVED', startDate: { lte: endOfDay }, endDate: { gte: startOfDay } },
        distinct: ['userId']
      }),
      prisma.leaveRequest.findMany({
        take: 5, orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true } }, leaveType: { select: { name: true } } }
      }),
      prisma.clockLog.findMany({
        take: 5, orderBy: { timestamp: 'desc' },
        include: { user: { select: { name: true } } }
      })
    ])
    console.log("Success", result[0]);
  } catch (error) {
    console.error("Dashboard error:", error);
  } finally {
    prisma.$disconnect();
  }
}
main();
