import { NextResponse, after } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendNotificationEmail, escapeHtml } from '@/lib/mail'
import { issuePasswordToken, RESET_TOKEN_TTL_MS } from '@/lib/tokens'
import { getBaseUrl } from '@/lib/url'
import { readJson } from '@/lib/api-auth'
import { z } from 'zod'

const forgotSchema = z.object({
  email: z.string().trim().email('Please provide a valid email address').max(254),
})

const MAX_TOKENS_PER_WINDOW = 3
const THROTTLE_WINDOW_MS = 15 * 60 * 1000

async function sendResetEmail(email: string) {
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' }, isActive: true },
  })
  if (!user) return

  // Per-account throttle so the endpoint can't be used to flood someone's inbox
  const recent = await prisma.passwordResetToken.count({
    where: { email: user.email, createdAt: { gt: new Date(Date.now() - THROTTLE_WINDOW_MS) } },
  })
  if (recent >= MAX_TOKENS_PER_WINDOW) return

  const token = await issuePasswordToken(user.email, RESET_TOKEN_TTL_MS)
  const resetUrl = `${getBaseUrl()}/reset-password?token=${token}`

  await sendNotificationEmail({
    to: user.email,
    subject: 'Password Reset Request',
    html: `
      <h2>Password Reset Request</h2>
      <p>Hello ${escapeHtml(user.name)},</p>
      <p>Someone recently requested a password reset for your account. If this was you, please click the button below to set a new password.</p>
      <p><strong>This link will expire in 30 minutes.</strong></p>
      <br />
      <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background-color:#3b82f6;color:white;text-decoration:none;border-radius:6px;font-weight:bold;">Reset Password</a>
      <br /><br />
      <p>If you did not request this, you can safely ignore this email.</p>
    `
  })
}

export async function POST(req: Request) {
  const parsed = forgotSchema.safeParse(await readJson(req))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  // Do the work after responding so the response (content and timing) is identical
  // whether or not the account exists.
  after(() => sendResetEmail(parsed.data.email).catch(err => console.error('Forgot Password Error:', err)))

  return NextResponse.json({ success: true })
}
