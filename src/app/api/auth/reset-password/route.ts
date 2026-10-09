import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { findPasswordToken } from '@/lib/tokens'
import { readJson } from '@/lib/api-auth'
import { passwordSchema } from '@/lib/validation'

const resetSchema = z.object({
  token: z.string().min(1, 'Token is required').max(200),
  password: passwordSchema,
})

export async function POST(req: Request) {
  try {
    const parsed = resetSchema.safeParse(await readJson(req))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }
    const { token, password } = parsed.data

    const resetToken = await findPasswordToken(token)
    if (!resetToken || new Date() > resetToken.expiresAt) {
      if (resetToken) await prisma.passwordResetToken.delete({ where: { id: resetToken.id } })
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 })
    }

    const user = await prisma.user.findFirst({
      where: { email: { equals: resetToken.email, mode: 'insensitive' } },
      select: { id: true, email: true },
    })
    if (!user) {
      await prisma.passwordResetToken.delete({ where: { id: resetToken.id } })
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    // Update the password, sign out existing sessions, and burn every token for this account
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          passwordChangedAt: new Date(),
          failedLoginAttempts: 0,
          lockedUntil: null,
        }
      }),
      prisma.passwordResetToken.deleteMany({ where: { email: resetToken.email } }),
    ])

    return NextResponse.json({ success: true, message: 'Password updated successfully' })
  } catch (error) {
    console.error('Reset Password Error:', error)
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 })
  }
}
