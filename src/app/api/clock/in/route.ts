import { getClientIp } from '@/lib/ip'
import { processDailyAttendance } from '@/lib/attendance'
import { recordClock } from '@/lib/clock'
import { requireUser } from '@/lib/api-auth'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const guard = await requireUser('EMPLOYEE')
  if (guard.response) return guard.response
  const { id: userId, shopId } = guard.user

  if (!shopId) {
    return NextResponse.json({ error: 'You are not assigned to a shop. Please contact your admin.' }, { status: 403 })
  }

  try {
    const result = await recordClock(userId, shopId, 'IN', getClientIp(req))

    if (result.status === 200) {
      try {
        await processDailyAttendance(userId, new Date())
      } catch (attendanceErr) {
        console.error('[Clock IN] processDailyAttendance failed:', attendanceErr)
        // The clock log is still recorded; the daily cron reprocesses attendance
      }
    }

    return NextResponse.json(result.body, { status: result.status })
  } catch (error) {
    console.error('[Clock IN] failed:', error)
    return NextResponse.json({ error: 'Failed to clock in. Please try again.' }, { status: 500 })
  }
}
