import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/api-auth'
import { NextResponse } from 'next/server'
import type { Prisma } from '@/generated/prisma/client'

function intParam(value: string | null, min: number, max: number): number | undefined | null {
  if (value === null || value === '') return undefined
  const n = Number(value)
  return Number.isInteger(n) && n >= min && n <= max ? n : null
}

export async function GET(req: Request) {
  const guard = await requireUser()
  if (guard.response) return guard.response
  const { user } = guard

  try {
    const { searchParams } = new URL(req.url)
    const month = intParam(searchParams.get('month'), 1, 12)
    const year = intParam(searchParams.get('year'), 2000, 2100)
    if (month === null || year === null) {
      return NextResponse.json({ error: 'Invalid month or year' }, { status: 400 })
    }

    const where: Prisma.PaySheetWhereInput = { month, year }

    // Employees can only see their own post-finalized paysheets
    if (user.role === 'EMPLOYEE') {
      where.userId = user.id
      where.status = { in: ['FINALIZED', 'PAYMENT_CLAIMED', 'ACKNOWLEDGED', 'DISPUTED'] }
    } else {
      const userId = searchParams.get('userId')
      if (userId) where.userId = userId
    }

    const paysheets = await prisma.paySheet.findMany({
      where,
      include: {
        user: { select: { name: true, shop: { select: { name: true } } } }
      },
      orderBy: [
        { year: 'desc' },
        { month: 'desc' },
        { user: { name: 'asc' } }
      ]
    })

    return NextResponse.json(paysheets)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch paysheets' }, { status: 500 })
  }
}
