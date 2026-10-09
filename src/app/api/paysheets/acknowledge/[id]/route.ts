import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/api-auth'
import { PaySheetStatus } from '@/generated/prisma/client'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireUser('EMPLOYEE')
  if (guard.response) return guard.response

  try {
    const { id } = await params

    const updated = await prisma.paySheet.updateMany({
      where: { id, userId: guard.user.id, status: PaySheetStatus.PAYMENT_CLAIMED },
      data: {
        status: PaySheetStatus.ACKNOWLEDGED,
        acknowledgedAt: new Date(),
      }
    })
    if (updated.count === 0) {
      return NextResponse.json({ error: 'Paysheet is not awaiting acknowledgment' }, { status: 400 })
    }

    return NextResponse.json(await prisma.paySheet.findUnique({ where: { id } }))
  } catch (error) {
    console.error('Error acknowledging payment:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
