import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/api-auth'
import { escapeHtml, emailButton, sendNotificationEmail } from '@/lib/mail'
import { getBaseUrl } from '@/lib/url'
import { NextResponse } from 'next/server'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireUser('ADMIN')
  if (guard.response) return guard.response

  try {
    const { id } = await params

    const updated = await prisma.$transaction(async (tx) => {
      // Only DRAFT -> FINALIZED; the status condition prevents double finalization
      const claimed = await tx.paySheet.updateMany({
        where: { id, status: 'DRAFT' },
        data: {
          status: 'FINALIZED',
          finalizedAt: new Date(),
          finalizedBy: guard.user.id,
        },
      })
      if (claimed.count === 0) return null

      const paysheet = await tx.paySheet.findUniqueOrThrow({
        where: { id },
        include: { user: { select: { id: true, name: true, email: true } } }
      })

      // Remove only the points this sheet deducted for. Points below the threshold, or
      // earned after the draft was generated, carry over to the next paysheet.
      // (Atomic decrement, so a penalty added at the same moment is not lost.)
      if (paysheet.penaltyPointsCharged > 0) {
        await tx.user.update({
          where: { id: paysheet.userId },
          data: { penaltyPoints: { decrement: paysheet.penaltyPointsCharged } }
        })
        await tx.user.updateMany({
          where: { id: paysheet.userId, penaltyPoints: { lt: 0 } },
          data: { penaltyPoints: 0 }
        })
      }

      return paysheet
    })

    if (!updated) {
      const exists = await prisma.paySheet.findUnique({ where: { id }, select: { id: true } })
      return exists
        ? NextResponse.json({ error: 'Only draft paysheets can be finalized' }, { status: 400 })
        : NextResponse.json({ error: 'Paysheet not found' }, { status: 404 })
    }

    const monthName = new Date(Date.UTC(2000, updated.month - 1)).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })

    await prisma.notification.create({
      data: {
        userId: updated.userId,
        title: 'Paysheet Finalized',
        message: `Your paysheet for ${monthName} ${updated.year} has been finalized.`,
        type: 'PAYROLL'
      }
    })

    await sendNotificationEmail({
      to: updated.user.email,
      subject: `Your paysheet for ${monthName} ${updated.year} is ready`,
      html: `<p>Hello <strong>${escapeHtml(updated.user.name)}</strong>,</p>
             <p>Your paysheet for <strong>${monthName} ${updated.year}</strong> has been finalized.</p>
             <p>Sign in to see your net pay and the full breakdown.</p>
             ${emailButton(`${getBaseUrl()}/employee/paysheet`, 'View my paysheet')}`
    })

    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'Failed to finalize paysheet' }, { status: 500 })
  }
}
