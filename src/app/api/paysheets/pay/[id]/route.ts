import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { paymentReference } = body

    const paysheet = await prisma.paySheet.update({
      where: { id: params.id },
      data: {
        status: 'PAYMENT_CLAIMED',
        paymentReference,
        paidAt: new Date(),
      }
    })

    return NextResponse.json(paysheet)
  } catch (error) {
    console.error('Error marking payment claimed:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
