import { prisma } from '@/lib/prisma'
import { requireUser, readJson } from '@/lib/api-auth'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { expireVerifications, sendVerificationEmail, VERIFICATION_WINDOW_MS } from '@/lib/verification'

const sendSchema = z.object({ userId: z.string().min(1).max(100) })

export async function POST(req: Request) {
  const guard = await requireUser('ADMIN')
  if (guard.response) return guard.response

  try {
    const parsed = sendSchema.safeParse(await readJson(req))
    if (!parsed.success) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }
    const { userId } = parsed.data

    const employee = await prisma.user.findUnique({ where: { id: userId } })
    if (!employee || employee.role !== 'EMPLOYEE' || !employee.isActive) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    await expireVerifications()

    const verification = await prisma.workVerification.create({
      data: { userId, expiresAt: new Date(Date.now() + VERIFICATION_WINDOW_MS) }
    })

    await sendVerificationEmail(employee, verification.id, 'Your manager has requested a manual active work verification check.')

    return NextResponse.json(verification)
  } catch {
    return NextResponse.json({ error: 'Failed to send verification ping' }, { status: 500 })
  }
}
