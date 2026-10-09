import { prisma } from '@/lib/prisma'
import { requireUser, readJson } from '@/lib/api-auth'
import { validate, monthYearSchema } from '@/lib/validation'
import { getSettings } from '@/lib/settings'
import { calculatePaysheet } from '@/lib/paysheet'
import { dbDate, monthBounds } from '@/lib/time'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const guard = await requireUser('ADMIN')
  if (guard.response) return guard.response

  const validation = validate(monthYearSchema, await readJson(req))
  if (!validation.success) return validation.response
  const { month, year } = validation.data

  try {
    const settings = await getSettings()
    const { first, last } = monthBounds(month, year)
    const monthStart = dbDate(first)
    const monthEnd = dbDate(last)

    const [activeUsers, existing] = await Promise.all([
      prisma.user.findMany({
        where: { role: 'EMPLOYEE', isActive: true },
        include: {
          dailyAttendances: { where: { date: { gte: monthStart, lte: monthEnd } } },
          leaveRequests: {
            where: { status: 'APPROVED', startDate: { lte: monthEnd }, endDate: { gte: monthStart } },
            include: { leaveType: { select: { isPaid: true } } },
          },
        },
      }),
      prisma.paySheet.findMany({ where: { month, year }, select: { userId: true, status: true } }),
    ])

    // Only DRAFT sheets are regenerated; anything past DRAFT is never touched
    const locked = new Set(existing.filter(p => p.status !== 'DRAFT').map(p => p.userId))
    const toGenerate = activeUsers.filter(u => !locked.has(u.id))

    const data = toGenerate.map(user =>
      calculatePaysheet(user, month, year, user.dailyAttendances, user.leaveRequests, settings)
    )

    await prisma.$transaction([
      prisma.paySheet.deleteMany({ where: { month, year, status: 'DRAFT' } }),
      prisma.paySheet.createMany({ data }),
    ])

    const skipped = activeUsers.length - toGenerate.length
    return NextResponse.json({
      success: true,
      message: `Successfully generated ${data.length} paysheet(s).` +
        (skipped > 0 ? ` ${skipped} already finalized or paid were left unchanged.` : ''),
    })
  } catch (error) {
    console.error('Generate Paysheets Error:', error)
    return NextResponse.json({ error: 'Failed to generate paysheets' }, { status: 500 })
  }
}
