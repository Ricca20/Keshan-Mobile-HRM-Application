import { prisma } from '@/lib/prisma'
import { processDailyAttendance } from '@/lib/attendance'
import { getSettings } from '@/lib/settings'
import { isAuthorizedCron } from '@/lib/cron'
import { AUTO_CLOSED_REASON } from '@/lib/clock'
import { expireVerifications } from '@/lib/verification'
import { colomboDateStr } from '@/lib/time'
import { NextResponse } from 'next/server'

// Scheduled at 18:30 UTC = 00:00 Asia/Colombo
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()
    // The Colombo day that just ended. 12h back is robust to the cron firing a little early or late.
    const yesterday = new Date(now.getTime() - 12 * 60 * 60 * 1000)

    // 1. Close open shifts (forgot to clock out)
    const activeUsers = await prisma.user.findMany({
      where: { role: 'EMPLOYEE', isActive: true },
      select: {
        id: true,
        shopId: true,
        clockLogs: {
          where: { OR: [{ isValid: true }, { flagReason: AUTO_CLOSED_REASON }] },
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
      }
    })

    let autoClosedCount = 0
    for (const user of activeUsers) {
      const last = user.clockLogs[0]
      if (last?.type === 'IN') {
        await prisma.clockLog.create({
          data: {
            userId: user.id,
            shopId: last.shopId,
            type: 'OUT',
            ipAddress: '0.0.0.0',
            isValid: false,
            flagReason: AUTO_CLOSED_REASON,
          }
        })
        autoClosedCount++
      }
    }

    // 2. Finalize attendance for the day that ended (missing clock-out -> half day, no logs -> absent)
    const settings = await getSettings()
    let attendanceErrors = 0
    for (const user of activeUsers) {
      await processDailyAttendance(user.id, yesterday, settings).catch(err => {
        attendanceErrors++
        console.error(`Attendance processing failed for ${user.id}:`, err)
      })
    }

    // 3. Catch any verifications that expired since the last sweep
    await expireVerifications()

    // 4. Data archiving
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const deletedNotifications = await prisma.notification.deleteMany({
      where: { createdAt: { lt: thirtyDaysAgo } }
    })

    const twoYearsAgo = new Date(now.getTime() - 2 * 365 * 24 * 60 * 60 * 1000)
    const deletedClockLogs = await prisma.clockLog.deleteMany({
      where: { createdAt: { lt: twoYearsAgo } }
    })
    await prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: now } } })

    // 5. Monthly backup reminder (first day of the month in Colombo)
    let reminderSent = false
    if (colomboDateStr(now).endsWith('-01')) {
      const admins = await prisma.user.findMany({ where: { role: 'ADMIN', isActive: true } })
      await prisma.notification.createMany({
        data: admins.map(admin => ({
          userId: admin.id,
          title: 'Monthly Data Export Reminder',
          message: 'Don\'t forget to export your monthly reports and backups!',
          type: 'SYSTEM',
        })),
      })
      reminderSent = admins.length > 0
    }

    return NextResponse.json({
      success: true,
      attendanceDate: colomboDateStr(yesterday),
      autoClosedShifts: autoClosedCount,
      attendanceErrors,
      archivedNotifications: deletedNotifications.count,
      archivedClockLogs: deletedClockLogs.count,
      monthlyReminderSent: reminderSent,
      timestamp: now.toISOString()
    })
  } catch (error) {
    console.error('Daily Cron Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to execute daily cron tasks' },
      { status: 500 }
    )
  }
}
