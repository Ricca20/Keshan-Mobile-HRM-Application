import { createHash, randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'

export const RESET_TOKEN_TTL_MS = 30 * 60 * 1000 // 30 minutes
export const SETUP_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * Issues a single-use password token. Only its SHA-256 hash is stored, and any
 * earlier tokens for the same email are revoked.
 */
export async function issuePasswordToken(email: string, ttlMs: number): Promise<string> {
  const token = randomBytes(32).toString('hex')

  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { email } }),
    prisma.passwordResetToken.create({
      data: { email, token: hashToken(token), expiresAt: new Date(Date.now() + ttlMs) },
    }),
  ])

  return token
}

/** Finds a stored token by its raw value (also accepts legacy plaintext rows until they expire). */
export function findPasswordToken(rawToken: string) {
  return prisma.passwordResetToken.findFirst({
    where: { token: { in: [hashToken(rawToken), rawToken] } },
  })
}
