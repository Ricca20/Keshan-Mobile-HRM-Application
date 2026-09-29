import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: 'ADMIN' | 'EMPLOYEE'
      shopId: string | null
    } & DefaultSession['user']
  }

  interface User {
    id: string
    role: 'ADMIN' | 'EMPLOYEE'
    shopId: string | null
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: 'ADMIN' | 'EMPLOYEE'
    shopId: string | null
    error?: string
  }
}
