import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/api-auth'
import { NextResponse } from 'next/server'

export async function GET() {
  const guard = await requireUser('EMPLOYEE')
  if (guard.response) return guard.response

  try {
    // Find any active pending verification
    const verification = await prisma.workVerification.findFirst({
      where: {
        userId: guard.user.id,
        status: 'PENDING',
        expiresAt: { gt: new Date() }
      },
      orderBy: { sentAt: 'desc' },
      select: { id: true, expiresAt: true },
    })

    return NextResponse.json(verification)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to check verification' }, { status: 500 })
  }
}
