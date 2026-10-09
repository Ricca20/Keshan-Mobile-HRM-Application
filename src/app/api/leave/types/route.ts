import { prisma } from '@/lib/prisma'
import { syncLeaveBalances } from '@/lib/leave'
import { requireUser, readJson, prismaErrorCode } from '@/lib/api-auth'
import { validate, leaveTypeSchema } from '@/lib/validation'
import { NextResponse } from 'next/server'

export async function GET() {
  const guard = await requireUser()
  if (guard.response) return guard.response

  try {
    // Both ADMIN and EMPLOYEE need to see leave types
    const types = await prisma.leaveType.findMany({
      orderBy: { name: 'asc' }
    })
    return NextResponse.json(types)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch leave types' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const guard = await requireUser('ADMIN')
  if (guard.response) return guard.response

  const validation = validate(leaveTypeSchema, await readJson(req))
  if (!validation.success) return validation.response

  try {
    const leaveType = await prisma.leaveType.create({
      data: validation.data
    })

    // Automatically generate balances for all active employees
    await syncLeaveBalances(leaveType.id, leaveType.daysAllowed)

    return NextResponse.json(leaveType)
  } catch (error) {
    if (prismaErrorCode(error) === 'P2002') {
      return NextResponse.json({ error: 'A leave type with this name already exists' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to create leave type' }, { status: 500 })
  }
}
