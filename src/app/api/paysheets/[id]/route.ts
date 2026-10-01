import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const updateSchema = z.object({
  bonuses: z.number().min(0).optional(),
  deductions: z.number().min(0).optional(),
  bonusNote: z.string().optional(),
  deductionNote: z.string().optional(),
})

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const paysheet = await prisma.paySheet.findUnique({
      where: { id },
      include: {
        user: { select: { name: true, shop: { select: { name: true } } } }
      }
    })

    if (!paysheet) {
      return NextResponse.json({ error: 'Paysheet not found' }, { status: 404 })
    }

    // Employees can only access their own paysheets in any post-finalized state
    if ((session.user as any).role === 'EMPLOYEE') {
      const allowedStatuses = ['FINALIZED', 'PAYMENT_CLAIMED', 'ACKNOWLEDGED', 'DISPUTED']
      if (
        paysheet.userId !== (session.user as any).id ||
        !allowedStatuses.includes(paysheet.status)
      ) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    return NextResponse.json(paysheet)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch paysheet' }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = await req.json()
    const validatedData = updateSchema.parse(body)

    const paysheet = await prisma.paySheet.findUnique({ where: { id } })
    if (!paysheet) {
      return NextResponse.json({ error: 'Paysheet not found' }, { status: 404 })
    }

    if (paysheet.status === 'FINALIZED') {
      return NextResponse.json({ error: 'Cannot edit a finalized paysheet' }, { status: 400 })
    }

    // Recalculate net pay
    const newBonuses = validatedData.bonuses ?? paysheet.bonuses
    const newDeductions = validatedData.deductions ?? paysheet.deductions
    const newNetPay = paysheet.baseSalary + paysheet.otPay - newDeductions + newBonuses

    const updated = await prisma.paySheet.update({
      where: { id },
      data: {
        bonuses: newBonuses,
        deductions: newDeductions,
        bonusNote: validatedData.bonusNote ?? paysheet.bonusNote,
        deductionNote: validatedData.deductionNote ?? paysheet.deductionNote,
        netPay: newNetPay
      },
      include: {
        user: { select: { name: true, shop: { select: { name: true } } } }
      }
    })

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to update paysheet' }, { status: 500 })
  }
}
