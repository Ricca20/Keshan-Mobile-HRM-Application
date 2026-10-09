import { prisma } from '@/lib/prisma'
import { requireUser, readJson } from '@/lib/api-auth'
import { validate, paysheetUpdateSchema } from '@/lib/validation'
import { calculateNetPay } from '@/lib/paysheet'
import { NextResponse } from 'next/server'

const EMPLOYEE_VISIBLE = ['FINALIZED', 'PAYMENT_CLAIMED', 'ACKNOWLEDGED', 'DISPUTED']

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireUser()
  if (guard.response) return guard.response
  const { user } = guard

  try {
    const { id } = await params
    const paysheet = await prisma.paySheet.findUnique({
      where: { id },
      include: {
        user: { select: { name: true, shop: { select: { name: true } } } }
      }
    })

    // Employees can only access their own paysheets in any post-finalized state
    if (
      !paysheet ||
      (user.role === 'EMPLOYEE' && (paysheet.userId !== user.id || !EMPLOYEE_VISIBLE.includes(paysheet.status)))
    ) {
      return NextResponse.json({ error: 'Paysheet not found' }, { status: 404 })
    }

    return NextResponse.json(paysheet)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch paysheet' }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireUser('ADMIN')
  if (guard.response) return guard.response

  const validation = validate(paysheetUpdateSchema, await readJson(req))
  if (!validation.success) return validation.response
  const changes = validation.data

  try {
    const { id } = await params

    const paysheet = await prisma.paySheet.findUnique({ where: { id } })
    if (!paysheet) {
      return NextResponse.json({ error: 'Paysheet not found' }, { status: 404 })
    }

    const bonuses = changes.bonuses ?? paysheet.bonuses
    const deductions = changes.deductions ?? paysheet.deductions

    // Only DRAFT paysheets are editable; the status condition makes this atomic
    const updated = await prisma.paySheet.updateMany({
      where: { id, status: 'DRAFT' },
      data: {
        bonuses,
        deductions,
        bonusNote: changes.bonusNote ?? paysheet.bonusNote,
        deductionNote: changes.deductionNote ?? paysheet.deductionNote,
        netPay: calculateNetPay(paysheet.baseSalary, paysheet.otPay, deductions, bonuses),
      },
    })
    if (updated.count === 0) {
      return NextResponse.json({ error: 'Only draft paysheets can be edited' }, { status: 400 })
    }

    const result = await prisma.paySheet.findUnique({
      where: { id },
      include: {
        user: { select: { name: true, shop: { select: { name: true } } } }
      }
    })
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update paysheet' }, { status: 500 })
  }
}
