import { prisma } from '@/lib/prisma'
import { requireUser, readJson } from '@/lib/api-auth'
import { validate } from '@/lib/validation'
import { processDailyAttendance } from '@/lib/attendance'
import { getSettings } from '@/lib/settings'
import { colomboDateStr, colomboTime, dbDateStr, eachDateStr } from '@/lib/time'
import { escapeHtml, sendNotificationEmail } from '@/lib/mail'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const reviewSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  approverNote: z.string().trim().max(1000).optional(),
})

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireUser('ADMIN')
  if (guard.response) return guard.response

  const validation = validate(reviewSchema, await readJson(req))
  if (!validation.success) return validation.response
  const { status, approverNote } = validation.data

  try {
    const { id } = await params

    const existing = await prisma.leaveRequest.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Leave request not found' }, { status: 404 })
    }
    if (existing.status === status) {
      return NextResponse.json({ error: `Leave request is already ${status.toLowerCase()}` }, { status: 400 })
    }

    const year = existing.startDate.getUTCFullYear()

    const result = await prisma.$transaction(async (tx) => {
      // Same lock as leave creation, so balance changes for this employee are serialized
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`leave:${existing.userId}`}))`

      // Re-read under the lock; the previous status decides how the balance moves
      const current = await tx.leaveRequest.findUniqueOrThrow({ where: { id } })
      if (current.status === status) return { error: `Leave request is already ${status.toLowerCase()}` }

      const balanceKey = {
        userId_leaveTypeId_year: { userId: current.userId, leaveTypeId: current.leaveTypeId, year }
      }

      if (status === 'APPROVED') {
        const balance = await tx.leaveBalance.findUnique({ where: balanceKey })
        if (!balance) return { error: 'Employee has no leave balance for this type and year' }
        if (balance.usedDays + current.totalDays > balance.totalDays) {
          return { error: `Insufficient balance: ${balance.totalDays - balance.usedDays} day(s) remaining, ${current.totalDays} requested` }
        }
        await tx.leaveBalance.update({ where: balanceKey, data: { usedDays: { increment: current.totalDays } } })
      } else if (current.status === 'APPROVED') {
        // APPROVED -> REJECTED: give the days back
        await tx.leaveBalance.update({ where: balanceKey, data: { usedDays: { decrement: current.totalDays } } })
      }

      const updatedRequest = await tx.leaveRequest.update({
        where: { id },
        data: {
          status,
          approverNote,
          approvedBy: guard.user.id,
          reviewedAt: new Date()
        },
        include: {
          user: { select: { name: true, email: true } },
          leaveType: { select: { name: true } }
        }
      })
      return { updatedRequest }
    })

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    const updated = result.updatedRequest

    // Recompute attendance for days already past so LEAVE/ABSENT reflects the decision
    const today = colomboDateStr()
    const settings = await getSettings()
    for (const day of eachDateStr(dbDateStr(updated.startDate), dbDateStr(updated.endDate))) {
      if (day >= today) break
      await processDailyAttendance(updated.userId, colomboTime(day, '12:00'), settings)
        .catch(err => console.error('Attendance reprocess failed:', err))
    }

    const type = status === 'APPROVED' ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED'
    const title = `Leave Request ${status === 'APPROVED' ? 'Approved' : 'Rejected'}`

    await prisma.notification.create({
      data: {
        userId: updated.userId,
        title,
        message: `Your leave request for ${updated.totalDays} day(s) of ${updated.leaveType.name} has been ${status.toLowerCase()}.`,
        type
      }
    })

    await sendNotificationEmail({
      to: updated.user.email,
      subject: `${title} - PhoneShop HRM`,
      html: `<p>Hello <strong>${escapeHtml(updated.user.name)}</strong>,</p>
             <p>Your leave request for ${updated.totalDays} day(s) of ${escapeHtml(updated.leaveType.name)} has been <strong>${status}</strong>.</p>
             ${approverNote ? `<p><strong>Note:</strong> ${escapeHtml(approverNote)}</p>` : ''}
             <p>Please log in to the HRM system for more details.</p>`
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Review leave request error:', error)
    return NextResponse.json({ error: 'Failed to review leave request' }, { status: 500 })
  }
}
