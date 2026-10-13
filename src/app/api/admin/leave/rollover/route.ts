import { requireUser } from '@/lib/api-auth'
import { NextResponse } from 'next/server'
import { ensureYearBalances } from '@/lib/leave'

export async function POST() {
  const guard = await requireUser('ADMIN')
  if (guard.response) return guard.response

  try {
    const count = await ensureYearBalances()

    return NextResponse.json({ success: true, createdCount: count })
  } catch (error) {
    console.error('Rollover Error:', error)
    return NextResponse.json({ error: 'Failed to run rollover' }, { status: 500 })
  }
}
