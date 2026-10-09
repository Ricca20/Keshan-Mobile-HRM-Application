import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser, readJson } from '@/lib/api-auth'
import { validate, markPaidSchema } from '@/lib/validation'
import { PaySheetStatus } from '@/generated/prisma/client'

/** Admin marks a FINALIZED paysheet as paid; the employee then acknowledges or disputes. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireUser('ADMIN')
  if (guard.response) return guard.response

  const validation = validate(markPaidSchema, (await readJson(req)) ?? {})
  if (!validation.success) return validation.response
  const { paymentReference } = validation.data

  try {
    const { id } = await params

    const updated = await prisma.paySheet.updateMany({
      where: { id, status: PaySheetStatus.FINALIZED },
      data: {
        status: PaySheetStatus.PAYMENT_CLAIMED,
        paymentReference: paymentReference || null,
        paidAt: new Date(),
      }
    })
    if (updated.count === 0) {
      return NextResponse.json({ error: 'Only finalized paysheets can be marked as paid' }, { status: 400 })
    }

    return NextResponse.json(await prisma.paySheet.findUnique({ where: { id } }))
  } catch (error) {
    console.error('Error marking payment claimed:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
