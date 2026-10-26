import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { findUsablePasswordToken } from '@/lib/tokens'
import { readJson } from '@/lib/api-auth'
import { passwordSchema } from '@/lib/validation'

const tokenSchema = z.string().trim().min(1, 'Token is required').max(200)

const resetSchema = z.object({
  token: tokenSchema,
  password: passwordSchema,
})

const INVALID_LINK =
  'This link is no longer valid. It may have expired or already been used to set a password.'

/** GET /api/auth/reset-password?token=... lets the page check a link before the user types a password. */
export async function GET(req: Request) {
  const parsed = tokenSchema.safeParse(new URL(req.url).searchParams.get('token') ?? '')
  if (!parsed.success) return NextResponse.json({ valid: false, error: INVALID_LINK })

  try {
    const usable = await findUsablePasswordToken(parsed.data)
    return NextResponse.json(usable ? { valid: true } : { valid: false, error: INVALID_LINK })
  } catch (error) {
    console.error('Check Reset Token Error:', error)
    return NextResponse.json({ error: 'Could not check this link' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const parsed = resetSchema.safeParse(await readJson(req))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }
    const { token, password } = parsed.data

    const usable = await findUsablePasswordToken(token)
    if (!usable) {
      return NextResponse.json({ error: INVALID_LINK, code: 'INVALID_TOKEN' }, { status: 400 })
    }
    const { resetToken, userId } = usable

    const hashedPassword = await bcrypt.hash(password, 12)

    // Update the password, sign out existing sessions, and burn every token for this account
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          password: hashedPassword,
          passwordChangedAt: new Date(),
          failedLoginAttempts: 0,
          lockedUntil: null,
        }
      }),
      prisma.passwordResetToken.deleteMany({ where: { email: { equals: resetToken.email, mode: 'insensitive' } } }),
    ])

    return NextResponse.json({ success: true, message: 'Password updated successfully' })
  } catch (error) {
    console.error('Reset Password Error:', error)
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 })
  }
}
