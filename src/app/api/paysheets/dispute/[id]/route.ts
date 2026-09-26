import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const paysheet = await prisma.paySheet.findUnique({
      where: { id },
      select: { userId: true, status: true }
    })

    if (!paysheet || paysheet.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (paysheet.status !== 'PAYMENT_CLAIMED') {
      return NextResponse.json({ error: 'Paysheet is not awaiting acknowledgment' }, { status: 400 })
    }

    const body = await req.json()
    const { reason } = body

    if (!reason) {
      return NextResponse.json({ error: 'Dispute reason is required' }, { status: 400 })
    }

    const updated = await prisma.paySheet.update({
      where: { id },
      data: {
        status: 'DISPUTED',
        disputeReason: reason,
      }
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error disputing payment:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
