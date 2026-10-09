import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/api-auth'
import { escapeHtml, sendNotificationEmail } from '@/lib/mail'
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

      // Penalty points were charged on this paysheet, so start counting again
      await tx.user.update({
        where: { id: paysheet.userId },
        data: { penaltyPoints: 0 }
      })

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
      subject: `Paysheet Finalized - ${monthName} ${updated.year}`,
      html: `<p>Hello <strong>${escapeHtml(updated.user.name)}</strong>,</p>
             <p>Your paysheet for <strong>${monthName} ${updated.year}</strong> has been finalized by HR.</p>
             <p>Please log in to the HRM system to view your net pay and full breakdown.</p>`
    })

    return NextResponse.json(updated)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to finalize paysheet' }, { status: 500 })
  }
}
