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

  // Prevent double clock-in
  const lastLog = await prisma.clockLog.findFirst({
    where: { userId },
    orderBy: { timestamp: 'desc' },
  })
  if (lastLog?.type === 'IN') {
    return NextResponse.json({ error: 'Already clocked in. Please clock out first.' }, { status: 400 })
  }

  // Get shop config
  const shop = await prisma.shop.findUnique({ where: { id: shopId } })
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

  const requestIp = getClientIp(req)

  // Validation check: IP Address strict validation
  // We allow "127.0.0.1" for local development bypassing
  const allowedIps = shop.allowedIp.split(',').map(ip => ip.trim())
  const ipPass = allowedIps.includes(requestIp) || requestIp === '127.0.0.1' || process.env.NODE_ENV === 'development'

  if (!ipPass) {
    // Record the failed attempt as flagged
    await prisma.clockLog.create({
      data: {
        userId,
        shopId,
        type: 'IN',
        ipAddress: requestIp,
        isValid: false,
        flagReason: `IP_FAIL (Expected: ${shop.allowedIp}, Got: ${requestIp})`,
      },
    })

    return NextResponse.json({
      success: false,
      message: 'You are not connected to the shop WiFi. Clock in denied.',
    }, { status: 403 })
  }

  // Valid clock in
  const log = await prisma.clockLog.create({
    data: {
      userId,
      shopId,
      type: 'IN',
      ipAddress: requestIp,
      isValid: true,
    },
  })

  return NextResponse.json({ success: true, log })
}
