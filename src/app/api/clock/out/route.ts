import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getClientIp } from '@/lib/ip'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || (session.user as any).role !== 'EMPLOYEE') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = (session.user as any).id
  const shopId = (session.user as any).shopId

  // Ensure they are currently clocked in
  const lastLog = await prisma.clockLog.findFirst({
    where: { userId, isValid: true },
    orderBy: { timestamp: 'desc' },
  })
  
  if (!lastLog || lastLog.type === 'OUT') {
    return NextResponse.json({ error: 'Not clocked in.' }, { status: 400 })
  }

  const shop = await prisma.shop.findUnique({ where: { id: shopId } })
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

  const requestIp = getClientIp(req)
  const ipPass = requestIp === shop.allowedIp || requestIp === '127.0.0.1' || process.env.NODE_ENV === 'development'

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

  return NextResponse.json({ success: true, log })
}
