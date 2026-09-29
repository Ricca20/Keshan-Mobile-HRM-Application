import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { PaySheetStatus } from '@/generated/prisma/client'

/**
 * POST /api/paysheets/resolve/[id]
 * Admin-only: Re-issue a disputed paysheet back to PAYMENT_CLAIMED state,
 * clearing the dispute reason so the employee can re-acknowledge.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()
    if ((session?.user as any)?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const paysheet = await prisma.paySheet.findUnique({
      where: { id },
      select: { status: true }
    })

    if (!paysheet) {
      return NextResponse.json({ error: 'Paysheet not found' }, { status: 404 })
    }

    if (paysheet.status !== PaySheetStatus.DISPUTED) {
      return NextResponse.json({ error: 'Only disputed paysheets can be resolved' }, { status: 400 })
    }

    // Re-issue: move back to PAYMENT_CLAIMED, clearing the dispute reason
    const updated = await prisma.paySheet.update({
      where: { id },
      data: {
        status: PaySheetStatus.PAYMENT_CLAIMED,
        disputeReason: null,
        paidAt: new Date(), // refresh timestamp
      }
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error resolving dispute:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
