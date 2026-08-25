import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = (session.user as any).id

  try {
    const lastLog = await prisma.clockLog.findFirst({
      where: { userId, isValid: true },
      orderBy: { timestamp: 'desc' },
    })

    const isClockedIn = lastLog?.type === 'IN'

    return NextResponse.json({
      isClockedIn,
      lastLog,
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 })
  }
}
