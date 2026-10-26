import { createHash, randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'

export const RESET_TOKEN_TTL_MS = 30 * 60 * 1000 // 30 minutes
export const SETUP_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

// Links kept alive per account. Re-sending a setup link or requesting a reset must not
// silently break the link the employee already has open; all of them are burned once
// one is used.
const MAX_ACTIVE_TOKENS = 5

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * Issues a single-use password token. Only its SHA-256 hash is stored. Expired tokens
 * and any beyond the newest few for the same email are removed.
 */
export async function issuePasswordToken(email: string, ttlMs: number): Promise<string> {
  const token = randomBytes(32).toString('hex')

  await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.create({
      data: { email, token: hashToken(token), expiresAt: new Date(Date.now() + ttlMs) },
    })

    const stale = await tx.passwordResetToken.findMany({
      where: { email },
      orderBy: { createdAt: 'desc' },
      skip: MAX_ACTIVE_TOKENS,
      select: { id: true },
    })
    await tx.passwordResetToken.deleteMany({
      where: {
        email,
        OR: [{ expiresAt: { lt: new Date() } }, { id: { in: stale.map(t => t.id) } }],
      },
    })
  })

  return token
}

/**
 * Pulls the token out of a link value. Mail apps and chat apps sometimes append
 * punctuation or tracking text, or change the case, when a link is tapped or copied.
 */
function normalizeToken(rawToken: string): string {
  return rawToken.match(/[a-f0-9]{64}/i)?.[0].toLowerCase() ?? rawToken.trim()
}

/** Finds a stored token by its raw value (also accepts legacy plaintext rows until they expire). */
export function findPasswordToken(rawToken: string) {
  const token = normalizeToken(rawToken)
  return prisma.passwordResetToken.findFirst({
    where: { token: { in: [hashToken(token), token] } },
  })
}

/** Returns the stored token only if it exists, has not expired and belongs to an active account. */
export async function findUsablePasswordToken(rawToken: string) {
  const resetToken = await findPasswordToken(rawToken)
  if (!resetToken || new Date() > resetToken.expiresAt) return null

  const user = await prisma.user.findFirst({
    where: { email: { equals: resetToken.email, mode: 'insensitive' }, isActive: true },
    select: { id: true },
  })
  return user ? { resetToken, userId: user.id } : null
}
