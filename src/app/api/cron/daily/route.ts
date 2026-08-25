import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  try {
    const now = new Date()

    // 1. Close open shifts (Forgot to clock out)
    const activeUsers = await prisma.user.findMany({
      where: { role: 'EMPLOYEE', isActive: true },
      select: { 
        id: true, 
        shopId: true,
        clockLogs: { orderBy: { timestamp: 'desc' }, take: 1 } 
      }
    })

    const usersToClockOut = activeUsers.filter(u => u.clockLogs.length > 0 && u.clockLogs[0].type === 'IN')
    
    let autoClosedCount = 0
    for (const user of usersToClockOut) {
      if (user.shopId) {
        await prisma.clockLog.create({
          data: {
            userId: user.id,
            shopId: user.shopId,
            type: 'OUT',
            ipAddress: '0.0.0.0',
            isValid: false,
            flagReason: 'AUTO_CLOSED_END_OF_DAY'
          }
        })
        autoClosedCount++
      }
    }

    // 2. Data Archiving
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const deletedNotifications = await prisma.notification.deleteMany({
      where: { createdAt: { lt: thirtyDaysAgo } }
    })

    const twoYearsAgo = new Date(now.getTime() - 2 * 365 * 24 * 60 * 60 * 1000)
    const deletedClockLogs = await prisma.clockLog.deleteMany({
      where: { createdAt: { lt: twoYearsAgo } }
    })

    // 3. Monthly Backup Reminder
    let reminderSent = false
    if (now.getDate() === 1) {
      const admins = await prisma.user.findMany({ where: { role: 'ADMIN', isActive: true } })
      for (const admin of admins) {
        await prisma.notification.create({
          data: {
            userId: admin.id,
            title: 'Monthly Data Export Reminder',
            message: 'Don\'t forget to export your monthly reports and backups!',
            type: 'SYSTEM'
          }
        })
      }
      reminderSent = admins.length > 0
    }

    return NextResponse.json({ 
      success: true, 
      autoClosedShifts: autoClosedCount,
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
