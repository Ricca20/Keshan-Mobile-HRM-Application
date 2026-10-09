import { prisma } from '@/lib/prisma'
import { requireUser, readJson } from '@/lib/api-auth'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { sendNotificationEmail, escapeHtml } from '@/lib/mail'
import { getBaseUrl } from '@/lib/url'
import { expireVerifications, VERIFICATION_WINDOW_MS } from '@/lib/verification'

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

    await sendNotificationEmail({
      to: employee.email,
      subject: 'URGENT: Active Work Verification',
      html: `<p>Hello <strong>${escapeHtml(employee.name)}</strong>,</p>
             <p>Your manager has requested a manual active work verification check.</p>
             <p>Please click the button below within <strong>2 minutes</strong> while connected to the shop WiFi to confirm you are actively working.</p>
             <a href="${getBaseUrl()}/verify/${verification.id}" style="display:inline-block;padding:10px 20px;background-color:#3b82f6;color:white;text-decoration:none;border-radius:5px;font-weight:bold;">Verify Now</a>`
    })

    return NextResponse.json(verification)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to send verification ping' }, { status: 500 })
  }
}
