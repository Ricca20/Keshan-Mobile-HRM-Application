import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/api-auth'
import { NextResponse } from 'next/server'

export async function POST() {
  const guard = await requireUser('ADMIN')
  if (guard.response) return guard.response

  try {
    const currentYear = new Date().getFullYear()
    const [employees, leaveTypes] = await Promise.all([
      prisma.user.findMany({ where: { isActive: true, role: 'EMPLOYEE' }, select: { id: true } }),
      prisma.leaveType.findMany({ where: { isActive: true } }),
    ])

    // Create this year's balance for every employee/leave type pair that doesn't have one
    const { count } = await prisma.leaveBalance.createMany({
      data: employees.flatMap(user => leaveTypes.map(leaveType => ({
        userId: user.id,
        leaveTypeId: leaveType.id,
        year: currentYear,
        totalDays: leaveType.daysAllowed,
        usedDays: 0,
      }))),
      skipDuplicates: true,
    })

    return NextResponse.json({ success: true, createdCount: count })
  } catch (error) {
    console.error('Rollover Error:', error)
    return NextResponse.json({ error: 'Failed to run rollover' }, { status: 500 })
  }
}
