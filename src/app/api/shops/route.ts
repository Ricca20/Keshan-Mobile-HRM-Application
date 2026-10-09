import { prisma } from '@/lib/prisma'
import { requireUser, readJson } from '@/lib/api-auth'
import { validate, shopSchema } from '@/lib/validation'
import { NextResponse } from 'next/server'

export async function GET() {
  const guard = await requireUser('ADMIN')
  if (guard.response) return guard.response

  try {
    const shops = await prisma.shop.findMany({
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(shops)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch shops' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const guard = await requireUser('ADMIN')
  if (guard.response) return guard.response

  const validation = validate(shopSchema, await readJson(req))
  if (!validation.success) return validation.response

  try {
    const shop = await prisma.shop.create({
      data: validation.data,
    })
    return NextResponse.json(shop)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create shop' }, { status: 500 })
  }
}
