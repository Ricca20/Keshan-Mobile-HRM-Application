import { prisma } from '@/lib/prisma'
import { sendNotificationEmail, escapeHtml } from '@/lib/mail'

export const VERIFICATION_WINDOW_MS = 2 * 60 * 1000

/**
 * Marks expired PENDING verifications as MISSED and adds one penalty point each.
 * Safe to call concurrently: each verification is claimed with a conditional update,
 * so a point is only ever added once.
 */
export async function expireVerifications(): Promise<number> {
  const now = new Date()
  const expired = await prisma.workVerification.findMany({
    where: { status: 'PENDING', expiresAt: { lt: now } },
    include: { user: { select: { name: true } } },
  })

  const missed: { name: string; points: number }[] = []
  for (const v of expired) {
    const points = await prisma.$transaction(async (tx) => {
      const claimed = await tx.workVerification.updateMany({
        where: { id: v.id, status: 'PENDING' },
        data: { status: 'MISSED' },
      })
      if (claimed.count === 0) return null
      const user = await tx.user.update({
        where: { id: v.userId },
        data: { penaltyPoints: { increment: 1 } },
        select: { penaltyPoints: true },
      })
      return user.penaltyPoints
    })
    if (points !== null) missed.push({ name: v.user.name, points })
  }

  if (missed.length > 0) {
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN', isActive: true } })
    const time = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Colombo' })

    await prisma.notification.createMany({
      data: admins.flatMap(admin => missed.map(m => ({
        userId: admin.id,
        title: 'Missed Work Verification',
        message: `${m.name} missed their work verification. Penalty point added automatically (now ${m.points} pts).`,
        type: 'VERIFICATION_MISSED',
      }))),
    })

    for (const admin of admins) {
      await sendNotificationEmail({
        to: admin.email,
        subject: 'Missed Work Verification - PhoneShop HRM',
        html: missed.map(m =>
          `<p><strong>${escapeHtml(m.name)}</strong> missed a random active work verification check (processed ${escapeHtml(time)}).
           A penalty point has been <strong>automatically added</strong>. Their current total is <strong>${m.points} point(s)</strong>.</p>`
        ).join(''),
      })
    }
  }

  return missed.length
}
