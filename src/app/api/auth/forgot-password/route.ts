import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendNotificationEmail } from '@/lib/mail'
import { z } from 'zod'

const forgotSchema = z.object({
  email: z.string().email('Please provide a valid email address'),
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { email } = forgotSchema.parse(body)

    const user = await prisma.user.findUnique({ where: { email } })

    // We don't want to leak whether the email exists, so we always return success.
    if (!user) {
      return NextResponse.json({ success: true })
    }

    // Generate a secure random token
    const token = crypto.randomUUID()

    // Expiration: 3 minutes from now
    const expiresAt = new Date(Date.now() + 3 * 60 * 1000)

    // Save token to DB
    await prisma.passwordResetToken.create({
      data: {
        email,
        token,
        expiresAt,
      }
    })

    const baseUrl = process.env.AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const resetUrl = `${baseUrl}/reset-password?token=${token}`

    // Send email
    await sendNotificationEmail({
      to: email,
      subject: 'Password Reset Request',
      html: `
        <h2>Password Reset Request</h2>
        <p>Hello ${user.name},</p>
        <p>Someone recently requested a password reset for your account. If this was you, please click the button below to set a new password.</p>
        <p><strong>This link will expire in 3 minutes.</strong></p>
        <br />
        <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background-color:#3b82f6;color:white;text-decoration:none;border-radius:6px;font-weight:bold;">Reset Password</a>
        <br /><br />
        <p>If you did not request this, you can safely ignore this email.</p>
      `
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error('Forgot Password Error:', error)
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 })
  }
}
