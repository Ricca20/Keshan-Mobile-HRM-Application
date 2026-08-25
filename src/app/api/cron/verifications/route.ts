import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { sendNotificationEmail } from '@/lib/mail'

export async function GET(req: Request) {
  // Optional: Check a cron secret token here
  // if (req.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) { ... }

  try {
    const now = new Date()

    // 1. Expire old pending verifications
    const expiredVerifications = await prisma.workVerification.findMany({
      where: {
        status: 'PENDING',
        expiresAt: { lt: now }
      },
      include: { user: true }
    })

    if (expiredVerifications.length > 0) {
      await prisma.workVerification.updateMany({
        where: {
          id: { in: expiredVerifications.map(v => v.id) }
        },
        data: { status: 'MISSED' }
      })

      // Auto-increment penalty points for each missed verification
      for (const v of expiredVerifications) {
        await prisma.user.update({
          where: { id: v.userId },
          data: { penaltyPoints: { increment: 1 } }
        })
      }

      // Notify Admins about missed verifications
      const admins = await prisma.user.findMany({ where: { role: 'ADMIN', isActive: true } })
      for (const v of expiredVerifications) {
        for (const admin of admins) {
          await prisma.notification.create({
            data: {
              userId: admin.id,
              title: 'Missed Work Verification',
              message: `${v.user.name} missed their work verification. Penalty point added automatically (now ${v.user.penaltyPoints + 1} pts).`,
              type: 'VERIFICATION_MISSED'
            }
          })
          
          await sendNotificationEmail({
            to: admin.email,
            subject: 'Missed Work Verification - PhoneShop HRM',
            html: `<p><strong>${v.user.name}</strong> missed a random active work verification check at ${now.toLocaleTimeString('en-US', { timeZone: 'Asia/Colombo' })}.</p>
                   <p>A penalty point has been <strong>automatically added</strong>. Their current total is <strong>${v.user.penaltyPoints + 1} point(s)</strong>.</p>`
          })
        }
      }
    }

    // 2. Randomly trigger new verifications for clocked-in users
    const users = await prisma.user.findMany({
      where: { role: 'EMPLOYEE', isActive: true },
      select: { 
        id: true, 
        name: true, 
        email: true, 
        clockLogs: { orderBy: { timestamp: 'desc' }, take: 1 } 
      }
    })

    const clockedInUsers = users.filter(u => u.clockLogs.length > 0 && u.clockLogs[0].type === 'IN')

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'

    for (const user of clockedInUsers) {
      // 30% chance to trigger a check
      if (Math.random() < 0.3) {
        const expiresAt = new Date(now.getTime() + 60 * 1000 * 2) // 2 minutes window
        
        const verification = await prisma.workVerification.create({
          data: {
            userId: user.id,
            expiresAt
          }
        })

      }
    }

    return NextResponse.json({ success: true, processed: expiredVerifications.length, checked: clockedInUsers.length })
  } catch (error) {
    console.error('Cron Error:', error)
    return NextResponse.json({ error: 'Failed to process verifications' }, { status: 500 })
  }
}
