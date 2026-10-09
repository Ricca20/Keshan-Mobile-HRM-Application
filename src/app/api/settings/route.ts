import { prisma } from '@/lib/prisma'
import { requireUser, readJson } from '@/lib/api-auth'
import { validate } from '@/lib/validation'
import { getSettings, settingsSchema } from '@/lib/settings'
import { NextResponse } from 'next/server'

export async function GET() {
  const guard = await requireUser('ADMIN')
  if (guard.response) return guard.response

  try {
    const settings = await getSettings()
    return NextResponse.json(Object.fromEntries(Object.entries(settings).map(([k, v]) => [k, String(v)])))
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const guard = await requireUser('ADMIN')
  if (guard.response) return guard.response

  // Only known keys with valid values are accepted
  const validation = validate(settingsSchema, await readJson(req))
  if (!validation.success) return validation.response

  try {
    await prisma.$transaction(
      Object.entries(validation.data).map(([key, value]) =>
        prisma.systemSetting.upsert({
          where: { key },
          update: { value: String(value) },
          create: { key, value: String(value) }
        })
      )
    )
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
