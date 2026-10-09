import { getSessionUser } from '@/lib/api-auth'
import { AUTO_CLOSED_REASON } from '@/lib/clock'
import { expireVerifications } from '@/lib/verification'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { VerificationClient } from './verification-client'

export default async function VerificationPage() {
  if (!(await getSessionUser('ADMIN'))) redirect('/login')

  // Process verifications that expired since the last sweep so the list is current
  await expireVerifications()

  // Get currently clocked-in users
  const users = await prisma.user.findMany({
    where: { role: 'EMPLOYEE', isActive: true },
    select: { 
      id: true, 
      name: true, 
      email: true, 
      penaltyPoints: true,
      clockLogs: {
        where: { OR: [{ isValid: true }, { flagReason: AUTO_CLOSED_REASON }] },
        orderBy: { timestamp: 'desc' },
        take: 1,
      },
    }
  })

  const onlineUsers = users
    .filter(u => u.clockLogs.length > 0 && u.clockLogs[0].type === 'IN')
    .map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      penaltyPoints: u.penaltyPoints
    }))

  // Get recent verifications
  const recentVerifications = await prisma.workVerification.findMany({
    take: 50,
    orderBy: { sentAt: 'desc' },
    include: {
      user: { select: { name: true, penaltyPoints: true } }
    }
  })

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Active Work Verification</h1>
          <p className="text-sm text-slate-500">Monitor and ping currently working employees.</p>
        </div>
      </div>

      <VerificationClient 
        onlineUsers={onlineUsers} 
        recentVerifications={recentVerifications} 
      />
    </div>
  )
}
