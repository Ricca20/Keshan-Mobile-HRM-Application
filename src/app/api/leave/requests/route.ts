import { prisma } from '@/lib/prisma'
import { calculateLeaveDays } from '@/lib/leave'
import { requireUser, readJson } from '@/lib/api-auth'
import { dateStrSchema, validate } from '@/lib/validation'
import { getSettings, weeklyOffDays } from '@/lib/settings'
import { colomboDateStr, addDays, dbDate } from '@/lib/time'
import { escapeHtml, sendNotificationEmail } from '@/lib/mail'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { Prisma } from '@/generated/prisma/client'

const MAX_LEAVE_SPAN_DAYS = 120

const leaveRequestSchema = z.object({
  leaveTypeId: z.string().min(1, 'Leave Type is required').max(100),
  startDate: dateStrSchema,
  endDate: dateStrSchema,
  reason: z.string().trim().min(1, 'Reason is required').max(1000),
})

const statusSchema = z.enum(['PENDING', 'APPROVED', 'REJECTED'])

export async function GET(req: Request) {
  const guard = await requireUser()
  if (guard.response) return guard.response
  const { user } = guard

  try {
    const { searchParams } = new URL(req.url)
    const where: Prisma.LeaveRequestWhereInput = {}

    // Employee can only see their own requests
    if (user.role === 'EMPLOYEE') {
      where.userId = user.id
    } else if (searchParams.get('userId')) {
      where.userId = searchParams.get('userId')!
    }

    const status = searchParams.get('status')
    if (status) {
      const parsed = statusSchema.safeParse(status)
      if (!parsed.success) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
      where.status = parsed.data
    }

    const requests = await prisma.leaveRequest.findMany({
      where,
      include: {
        user: { select: { name: true, email: true, shop: { select: { name: true } } } },
        leaveType: { select: { name: true, isPaid: true } }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(requests)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch leave requests' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const guard = await requireUser('EMPLOYEE')
  if (guard.response) return guard.response
  const userId = guard.user.id

  const validation = validate(leaveRequestSchema, await readJson(req))
  if (!validation.success) return validation.response
  const { leaveTypeId, startDate: startStr, endDate: endStr, reason } = validation.data

  if (startStr > endStr) {
    return NextResponse.json({ error: 'Start Date cannot be after End Date' }, { status: 400 })
  }
  if (startStr < addDays(colomboDateStr(), -30)) {
    return NextResponse.json({ error: 'Leave cannot start more than 30 days in the past' }, { status: 400 })
  }
  if (endStr > addDays(startStr, MAX_LEAVE_SPAN_DAYS)) {
    return NextResponse.json({ error: `A single request cannot exceed ${MAX_LEAVE_SPAN_DAYS} days` }, { status: 400 })
  }
  if (startStr.slice(0, 4) !== endStr.slice(0, 4)) {
    return NextResponse.json({ error: 'Leave cannot span two calendar years. Please submit one request per year.' }, { status: 400 })
  }

  try {
    const settings = await getSettings()
    const totalDays = calculateLeaveDays(startStr, endStr, weeklyOffDays(settings))
    if (totalDays === 0) {
      return NextResponse.json({ error: 'The selected dates are all non-working days' }, { status: 400 })
    }

    const startDate = dbDate(startStr)
    const endDate = dbDate(endStr)
    const year = Number(startStr.slice(0, 4))

    const result = await prisma.$transaction(async (tx) => {
      // Serialize this employee's leave changes so balance checks can't race
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`leave:${userId}`}))`

      const leaveType = await tx.leaveType.findUnique({ where: { id: leaveTypeId } })
      if (!leaveType || !leaveType.isActive) return { error: 'Invalid leave type' }

      const balance = await tx.leaveBalance.findUnique({
        where: { userId_leaveTypeId_year: { userId, leaveTypeId, year } }
      })
      if (!balance) return { error: 'No leave balance found for this type. Contact Admin.' }

      // Pending requests reserve days so several requests can't overspend the balance
      const pending = await tx.leaveRequest.aggregate({
        where: {
          userId, leaveTypeId, status: 'PENDING',
          startDate: { gte: dbDate(`${year}-01-01`), lte: dbDate(`${year}-12-31`) },
        },
        _sum: { totalDays: true },
      })
      const remainingDays = balance.totalDays - balance.usedDays - (pending._sum.totalDays ?? 0)
      if (totalDays > remainingDays) {
        return { error: `Insufficient balance. You requested ${totalDays} day(s), but only have ${Math.max(0, remainingDays)} day(s) available (including pending requests).` }
      }

      const overlapping = await tx.leaveRequest.findFirst({
        where: {
          userId,
          status: { in: ['APPROVED', 'PENDING'] },
          startDate: { lte: endDate },
          endDate: { gte: startDate },
        }
      })
      if (overlapping) return { error: 'You already have a pending or approved leave request during this period.' }

      const leaveRequest = await tx.leaveRequest.create({
        data: { userId, leaveTypeId, startDate, endDate, totalDays, reason, status: 'PENDING' }
      })
      return { leaveRequest }
    })

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    // Notify Admins
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN', isActive: true } })
    const employee = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })

    if (admins.length > 0 && employee) {
      await prisma.notification.createMany({
        data: admins.map(admin => ({
          userId: admin.id,
          title: 'New Leave Request',
          message: `${employee.name} has requested ${totalDays} day(s) of leave.`,
          type: 'LEAVE_REQUEST'
        }))
      })

      for (const admin of admins) {
        await sendNotificationEmail({
          to: admin.email,
          subject: 'New Leave Request - PhoneShop HRM',
          html: `<p><strong>${escapeHtml(employee.name)}</strong> has requested ${totalDays} day(s) of leave.</p>
                 <p><strong>Reason:</strong> ${escapeHtml(reason)}</p>
                 <p><strong>Dates:</strong> ${startStr} to ${endStr}</p>
                 <p>Please log in to the HRM system to review.</p>`
        })
      }
    }

    return NextResponse.json(result.leaveRequest)
  } catch (error) {
    console.error('Create leave request error:', error)
    return NextResponse.json({ error: 'Failed to create leave request' }, { status: 500 })
  }
}
