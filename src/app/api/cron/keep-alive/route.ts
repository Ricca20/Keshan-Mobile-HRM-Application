import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  try {
    // Perform a lightweight query to wake up / keep the Supabase database alive
    await prisma.$queryRaw`SELECT 1`

    return NextResponse.json({ 
      success: true, 
      message: 'Database keep-alive ping successful',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Keep-Alive Cron Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to ping database' }, 
      { status: 500 }
    )
  }
}
