import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST() {
  const session = await auth()
  if (!session || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const currentYear = new Date().getFullYear()
    const activeUsers = await prisma.user.findMany({ where: { isActive: true } })
    const activeLeaveTypes = await prisma.leaveType.findMany({ where: { isActive: true } })

    let createdCount = 0

    // For each active user and leave type, create balance if it doesn't exist for the current year
    for (const user of activeUsers) {
      for (const leaveType of activeLeaveTypes) {
        const existing = await prisma.leaveBalance.findUnique({
          where: {
            userId_leaveTypeId_year: {
              userId: user.id,
              leaveTypeId: leaveType.id,
              year: currentYear
            }
          }
        })

        if (!existing) {
          await prisma.leaveBalance.create({
            data: {
              userId: user.id,
              leaveTypeId: leaveType.id,
              year: currentYear,
              totalDays: leaveType.daysAllowed,
              usedDays: 0
            }
          })
          createdCount++
        }
      }
    }

    return NextResponse.json({ success: true, createdCount })
  } catch (error) {
    console.error('Rollover Error:', error)
    return NextResponse.json({ error: 'Failed to run rollover' }, { status: 500 })
  }
}
