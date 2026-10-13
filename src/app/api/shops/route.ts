import { prisma } from '@/lib/prisma'
import { requireUser, readJson } from '@/lib/api-auth'
import { validate, shopSchema } from '@/lib/validation'
import { NextResponse } from 'next/server'
import { ipInList, ipv6Network64 } from '@/lib/clock'

const DENIED_LOOKBACK_MS = 48 * 60 * 60 * 1000

export async function GET() {
  const guard = await requireUser('ADMIN')
  if (guard.response) return guard.response

  try {
    const [shops, denied] = await Promise.all([
      prisma.shop.findMany({
        orderBy: { name: 'asc' },
        include: { _count: { select: { users: { where: { role: 'EMPLOYEE', isActive: true } } } } },
      }),
      // Networks employees were turned away from recently: usually the shop's internet IP changed
      prisma.clockLog.groupBy({
        by: ['shopId', 'ipAddress'],
        where: { flagReason: 'IP_FAIL', timestamp: { gte: new Date(Date.now() - DENIED_LOOKBACK_MS) } },
        _count: { _all: true },
        _max: { timestamp: true },
      }),
    ])

    return NextResponse.json(shops.map(({ _count, ...shop }) => ({
      ...shop,
      employeeCount: _count.users,
      // Hide networks that have been allowed since the denial
      recentDenied: denied
        .filter(d => d.shopId === shop.id && !ipInList(shop.allowedIp, d.ipAddress))
        .sort((a, b) => (b._max.timestamp?.getTime() ?? 0) - (a._max.timestamp?.getTime() ?? 0))
        .slice(0, 5)
        .map(d => ({
          ip: d.ipAddress,
          rule: ipv6Network64(d.ipAddress) ?? d.ipAddress,
          attempts: d._count._all,
          lastAt: d._max.timestamp,
        })),
    })))
  } catch {
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
  } catch {
    return NextResponse.json({ error: 'Failed to create shop' }, { status: 500 })
  }
}
