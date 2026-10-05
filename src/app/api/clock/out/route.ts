import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getClientIp } from '@/lib/ip'
import { processDailyAttendance } from '@/lib/attendance'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || (session.user as any).role !== 'EMPLOYEE') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = (session.user as any).id
  const shopId = (session.user as any).shopId

  if (!shopId) {
    return NextResponse.json({ error: 'You are not assigned to a shop. Please contact your admin.' }, { status: 403 })
  }

  // Ensure they are currently clocked in
  const lastLog = await prisma.clockLog.findFirst({
    where: { userId, isValid: true },
    orderBy: { timestamp: 'desc' },
  })
  
  if (!lastLog || lastLog.type === 'OUT') {
    return NextResponse.json({ error: 'Not clocked in.' }, { status: 400 })
  }

  const shop = await prisma.shop.findUnique({ where: { id: shopId } })
  if (!shop) return NextResponse.json({ error: 'Your assigned shop was not found. Please contact your admin.' }, { status: 404 })


  const requestIp = getClientIp(req)
  const allowedIps = shop.allowedIp.split(',').map(ip => ip.trim())
  const ipPass = allowedIps.includes(requestIp) || requestIp === '127.0.0.1' || process.env.NODE_ENV === 'development' || shop.allowedIp === 'BYPASS'

  if (!ipPass) {
    // Record the failed out attempt
    await prisma.clockLog.create({
      data: {
        userId,
        shopId,
        type: 'OUT',
        ipAddress: requestIp,
        isValid: false,
        flagReason: `IP_FAIL (Expected: ${shop.allowedIp}, Got: ${requestIp})`,
      },
    })

    return NextResponse.json({
      success: false,
      message: 'You are not connected to the shop WiFi. Clock out denied.',
    }, { status: 403 })
  }

  // Valid clock out
  const log = await prisma.clockLog.create({
    data: {
      userId,
      shopId,
      type: 'OUT',
      ipAddress: requestIp,
      isValid: true,
    },
  })

  // Process attendance — await so errors are caught, not silently lost
  try {
    await processDailyAttendance(userId, new Date())
  } catch (attendanceErr) {
    console.error('[Clock OUT] processDailyAttendance failed:', attendanceErr)
    // Clock-out is still recorded — attendance can be reprocessed by cron or admin
  }

  return NextResponse.json({ success: true, log })
}
