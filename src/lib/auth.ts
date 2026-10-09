import NextAuth, { CredentialsSignin } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

class CustomAuthError extends CredentialsSignin {
  code: string
  constructor(message: string) {
    super(message)
    this.code = message
  }
}

// Single generic code so the login form never reveals whether an account exists
const INVALID_CREDENTIALS = 'INVALID_CREDENTIALS'

const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_MS = 15 * 60 * 1000

// Compared against when the user doesn't exist, so response timing doesn't leak that either
const DUMMY_HASH = bcrypt.hashSync('timing-equalizer-not-a-real-password', 12)

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === 'string' ? credentials.email.trim() : ''
        const password = typeof credentials?.password === 'string' ? credentials.password : ''
        if (!email || !password || password.length > 200) throw new CustomAuthError(INVALID_CREDENTIALS)

        try {
          const user = await prisma.user.findFirst({
            where: { email: { equals: email, mode: 'insensitive' } },
          })

          const passwordMatch = await bcrypt.compare(password, user?.password ?? DUMMY_HASH)
          if (!user) throw new CustomAuthError(INVALID_CREDENTIALS)

          if (user.lockedUntil && user.lockedUntil > new Date()) {
            throw new CustomAuthError(INVALID_CREDENTIALS)
          }

          if (!passwordMatch) {
            const attempts = user.failedLoginAttempts + 1
            await prisma.user.update({
              where: { id: user.id },
              data: attempts >= MAX_FAILED_ATTEMPTS
                ? { failedLoginAttempts: 0, lockedUntil: new Date(Date.now() + LOCKOUT_MS) }
                : { failedLoginAttempts: attempts },
            })
            throw new CustomAuthError(INVALID_CREDENTIALS)
          }

          if (!user.isActive) throw new CustomAuthError(INVALID_CREDENTIALS)

          if (user.failedLoginAttempts > 0 || user.lockedUntil) {
            await prisma.user.update({
              where: { id: user.id },
              data: { failedLoginAttempts: 0, lockedUntil: null },
            })
          }

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            shopId: user.shopId,
          }
        } catch (e) {
          if (e instanceof CustomAuthError) throw e
          console.error('AUTHORIZE ERROR:', e)
          throw new CustomAuthError(INVALID_CREDENTIALS)
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role
        token.shopId = user.shopId
        token.authTime = Date.now()
        return token
      }

      // On subsequent requests, verify the user is still active and hasn't changed password
      if (token.sub) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { isActive: true, role: true, shopId: true, passwordChangedAt: true }
        })

        const passwordChangedAfterLogin =
          !!dbUser?.passwordChangedAt &&
          dbUser.passwordChangedAt.getTime() > (token.authTime ?? 0)

        if (!dbUser || !dbUser.isActive || passwordChangedAfterLogin) {
          token.error = 'Deactivated'
        } else {
          token.role = dbUser.role
          token.shopId = dbUser.shopId
        }
      }
      return token
    },
    async session({ session, token }) {
      if (token.error === 'Deactivated') {
        // No user on the session: every guard treats this as signed out
        return { expires: session.expires } as typeof session
      }

      if (session.user) {
        session.user.id = token.sub as string
        session.user.role = token.role
        session.user.shopId = token.shopId
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
  session: { strategy: 'jwt', maxAge: 12 * 60 * 60 }, // 12 hours
  secret: process.env.AUTH_SECRET,
  trustHost: true,
})
