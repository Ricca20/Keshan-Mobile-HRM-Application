import { prisma } from '@/lib/prisma'
import { requireUser, readJson, prismaErrorCode } from '@/lib/api-auth'
import { validate, shopSchema } from '@/lib/validation'
import { NextResponse } from 'next/server'

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireUser('ADMIN')
  if (guard.response) return guard.response

  const validation = validate(shopSchema, await readJson(req))
  if (!validation.success) return validation.response

  try {
    const { id } = await params
    const shop = await prisma.shop.update({
      where: { id },
      data: validation.data,
    })
    return NextResponse.json(shop)
  } catch (error) {
    if (prismaErrorCode(error) === 'P2025') return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
    return NextResponse.json({ error: 'Failed to update shop' }, { status: 500 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireUser('ADMIN')
  if (guard.response) return guard.response

  try {
    const { id } = await params

    const shop = await prisma.shop.findUnique({
      where: { id },
      include: {
        _count: {
          select: { users: true, clockLogs: true }
        }
      }
    })

    if (!shop) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
    }

    if (shop._count.users > 0 || shop._count.clockLogs > 0) {
      return NextResponse.json(
        { error: 'Cannot delete shop with existing employees or logs.' },
        { status: 400 }
      )
    }

    await prisma.shop.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete shop' }, { status: 500 })
  }
}
