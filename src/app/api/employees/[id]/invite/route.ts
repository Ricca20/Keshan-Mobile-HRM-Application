import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/api-auth'
import { sendSetupInvite } from '@/lib/invite'
import { NextResponse } from 'next/server'

/**
 * POST /api/employees/[id]/invite
 * Re-sends the password setup email (e.g. it went to spam or expired) and returns the
 * link so the admin can share it another way. Older links stop working.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireUser('ADMIN')
  if (guard.response) return guard.response

  try {
    const { id } = await params
    const employee = await prisma.user.findUnique({
      where: { id },
      select: { name: true, email: true, role: true, isActive: true },
    })
    if (!employee || employee.role !== 'EMPLOYEE') {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }
    if (!employee.isActive) {
      return NextResponse.json({ error: 'Activate this employee before sending a setup link' }, { status: 400 })
    }

    const setupUrl = await sendSetupInvite(employee)
    return NextResponse.json({ success: true, setupUrl })
  } catch (error) {
    console.error('Resend invite error:', error)
    return NextResponse.json({ error: 'Failed to send setup link' }, { status: 500 })
  }
}
