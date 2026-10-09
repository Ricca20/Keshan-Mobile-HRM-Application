import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/api-auth'
import { monthYearSchema } from '@/lib/validation'
import { generatePaysheetExcel } from '@/lib/excel'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const guard = await requireUser('ADMIN')
  if (guard.response) return guard.response

  try {
    const { searchParams } = new URL(req.url)
    const parsed = monthYearSchema.safeParse({
      month: searchParams.get('month'),
      year: searchParams.get('year'),
    })
    if (!parsed.success) {
      return NextResponse.json({ error: 'Valid month and year required' }, { status: 400 })
    }
    const { month, year } = parsed.data

    const paysheets = await prisma.paySheet.findMany({
      where: { month, year },
      include: {
        user: { select: { name: true, shop: { select: { name: true } } } }
      },
      orderBy: { user: { name: 'asc' } }
    })

    if (paysheets.length === 0) {
      return NextResponse.json({ error: 'No paysheets found for this month' }, { status: 404 })
    }

    const buffer = await generatePaysheetExcel(paysheets)

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Paysheets_${year}_${month}.xlsx"`,
        'Cache-Control': 'no-store',
      }
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to export paysheets' }, { status: 500 })
  }
}
