import { NextResponse, after } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendNotificationEmail, escapeHtml, emailButton } from '@/lib/mail'
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
    subject: 'Reset your password',
    html: `<h2 style="margin:0 0 12px;">Reset your password</h2>
           <p>Hello ${escapeHtml(user.name)},</p>
           <p>We received a request to reset the password for your staff account. If this was you, click the button below to choose a new password.</p>
           ${emailButton(resetUrl, 'Choose a new password')}
           <p style="color:#64748b;font-size:13px;">This link expires in 30 minutes. If you did not request this, you can ignore this email.</p>`
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
