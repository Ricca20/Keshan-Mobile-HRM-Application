import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/api-auth'
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
  const guard = await requireUser('ADMIN')
  if (guard.response) return guard.response

  try {
    const { id } = await params

    const updated = await prisma.paySheet.updateMany({
      where: { id, status: PaySheetStatus.DISPUTED },
      data: {
        status: PaySheetStatus.PAYMENT_CLAIMED,
        disputeReason: null,
        paidAt: new Date(), // refresh timestamp
      }
    })
    if (updated.count === 0) {
      return NextResponse.json({ error: 'Only disputed paysheets can be resolved' }, { status: 400 })
    }

    return NextResponse.json(await prisma.paySheet.findUnique({ where: { id } }))
  } catch (error) {
    console.error('Error resolving dispute:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
