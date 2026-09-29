import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { validate, markPaidSchema } from '@/lib/validation'
import { PaySheetStatus } from '@/generated/prisma/client'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()
    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rawBody = await req.json()
    const validation = validate(markPaidSchema, rawBody)
    if (!validation.success) return validation.response
    const { paymentReference } = validation.data

    const paysheet = await prisma.paySheet.update({
      where: { id },
      data: {
        status: PaySheetStatus.PAYMENT_CLAIMED,
        paymentReference: paymentReference ?? null,
        paidAt: new Date(),
      }
    })

    return NextResponse.json(paysheet)
  } catch (error) {
    console.error('Error marking payment claimed:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
