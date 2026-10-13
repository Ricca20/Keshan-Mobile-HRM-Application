import { PrismaClient } from '@/generated/prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const connectionString = process.env.DATABASE_URL
// Limit max connections to 3 to prevent EMAXCONNSESSION (15 limit) on Supabase pooler
// when Vercel serverless functions spin up and run Promise.all
const pool = new Pool({ 
  connectionString,
  max: 3,
  idleTimeoutMillis: 3000,
})
const adapter = new PrismaPg(pool)

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query'] : [],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

/**
 * Options for interactive transactions. The 5s default is too tight when a request
 * waits on a per-employee advisory lock or the database is slow to answer.
 */
export const INTERACTIVE_TX = { maxWait: 10_000, timeout: 20_000 }
