import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/api-auth'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const guard = await requireUser()
  if (guard.response) return guard.response
  const { user } = guard

  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId') || user.id

    // Users can only query their own balances unless they are an admin
    if (user.role !== 'ADMIN' && userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const balances = await prisma.leaveBalance.findMany({
      where: { userId, year: new Date().getFullYear() },
      include: { leaveType: true },
      orderBy: { leaveType: { name: 'asc' } }
    })

    return NextResponse.json(balances)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch leave balances' }, { status: 500 })
  }
}
