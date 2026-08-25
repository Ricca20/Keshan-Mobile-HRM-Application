import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email as string },
            include: { shop: true },
          })

          if (!user) throw new Error('Debug: User not found in database for email: ' + credentials.email)
          if (!user.isActive) throw new Error('Debug: User is not active.')

          const passwordMatch = await bcrypt.compare(
            credentials.password as string,
            user.password
          )
          if (!passwordMatch) throw new Error('Debug: Password does not match hash. Input: ' + credentials.password)

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            shopId: user.shopId,
          } as any
        } catch (e: any) {
          console.error("AUTHORIZE ERROR:", e)
          throw e
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role
        token.shopId = (user as any).shopId
      }
      
      // On subsequent requests, verify user is still active
      if (!user && token.sub) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { isActive: true, role: true, shopId: true }
        })
        
        if (!dbUser || !dbUser.isActive) {
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
        return {} as any
      }

      if (session.user) {
        ;(session.user as any).id = token.sub
        ;(session.user as any).role = token.role
        ;(session.user as any).shopId = token.shopId
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
  session: { strategy: 'jwt' },
})
