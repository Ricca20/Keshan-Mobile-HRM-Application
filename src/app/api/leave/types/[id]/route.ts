import { prisma } from '@/lib/prisma'
import { requireUser, readJson, prismaErrorCode } from '@/lib/api-auth'
import { validate, leaveTypeUpdateSchema as updateSchema } from '@/lib/validation'
import { NextResponse } from 'next/server'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireUser('ADMIN')
  if (guard.response) return guard.response

  const validation = validate(updateSchema, await readJson(req))
  if (!validation.success) return validation.response

  try {
    const { id } = await params

    // daysAllowed applies to balances created from now on (new employees, next year's rollover)
    const leaveType = await prisma.leaveType.update({
      where: { id },
      data: validation.data
    })

    return NextResponse.json(leaveType)
  } catch (error) {
    const code = prismaErrorCode(error)
    if (code === 'P2002') return NextResponse.json({ error: 'Another leave type with this name already exists' }, { status: 400 })
    if (code === 'P2025') return NextResponse.json({ error: 'Leave type not found' }, { status: 404 })
    return NextResponse.json({ error: 'Failed to update leave type' }, { status: 500 })
  }
}
