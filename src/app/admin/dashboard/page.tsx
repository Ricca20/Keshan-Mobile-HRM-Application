import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  Users,
  Clock,
  TreePalm,
  AlertTriangle,
  UserX,
  FileSpreadsheet
} from 'lucide-react'
import Link from 'next/link'

export default async function AdminDashboard() {
  const session = await auth()

  const today = new Date()
  const startOfDay = new Date(today.setHours(0, 0, 0, 0))
  const endOfDay = new Date(today.setHours(23, 59, 59, 999))
  
  const currentMonth = today.getMonth() + 1
  const currentYear = today.getFullYear()

  // Run all database queries concurrently to avoid waterfall delays
  const [
    totalEmployees,
    clockInsToday,
    pendingLeaves,
    flaggedEntries,
    draftPaysheets,
    onLeaveToday,
    recentLeaves,
    recentLogs
  ] = await Promise.all([
    // 1. Total Employees
    prisma.user.count({
      where: { role: 'EMPLOYEE', isActive: true }
    }),
    
    // 2. Clocked In Today (Unique users who have an 'IN' log today)
    prisma.clockLog.findMany({
      where: {
        type: 'IN',
        timestamp: { gte: startOfDay, lte: endOfDay }
      },
      distinct: ['userId']
    }),
    
    // 3. Pending Leave
    prisma.leaveRequest.count({
      where: { status: 'PENDING' }
    }),
    
    // 4. Flagged Entries (Clock logs that were flagged today)
    prisma.clockLog.count({
      where: {
        isValid: false,
        timestamp: { gte: startOfDay, lte: endOfDay }
      }
    }),
    
    // 5. Unfinalized Paysheets (Drafts for current month)
    prisma.paySheet.count({
      where: { status: 'DRAFT', month: currentMonth, year: currentYear }
    }),
    
    // 6. Absent Today
    prisma.leaveRequest.findMany({
      where: {
        status: 'APPROVED',
        startDate: { lte: endOfDay },
        endDate: { gte: startOfDay }
      },
      distinct: ['userId']
    }),

    // 7. Recent 5 leave requests for the widget
    prisma.leaveRequest.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true } }, leaveType: { select: { name: true } } }
    }),

    // 8. Recent 5 clock logs
    prisma.clockLog.findMany({
      take: 5,
      orderBy: { timestamp: 'desc' },
      include: { user: { select: { name: true } } }
    })
  ])

  const clockedInCount = clockInsToday.length
  const absentCount = Math.max(0, totalEmployees - clockedInCount - onLeaveToday.length)

  const statCards = [
    {
      title: 'Total Employees',
      value: totalEmployees.toString(),
      subtitle: 'Active staff members',
      icon: Users,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-500',
      href: '/admin/employees'
    },
    {
      title: 'Clocked In Today',
      value: clockedInCount.toString(),
      subtitle: 'Currently at work',
      icon: Clock,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-500',
      href: '/admin/attendance'
    },
    {
      title: 'Pending Leave',
      value: pendingLeaves.toString(),
      subtitle: 'Awaiting approval',
      icon: TreePalm,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-500',
      href: '/admin/leave'
    },
    {
      title: 'Flagged Entries',
      value: flaggedEntries.toString(),
      subtitle: 'Security warnings today',
      icon: AlertTriangle,
      iconBg: 'bg-red-50',
      iconColor: 'text-red-500',
      href: '/admin/attendance'
    },
    {
      title: 'Draft Paysheets',
      value: draftPaysheets.toString(),
      subtitle: `For ${new Date(2000, currentMonth - 1).toLocaleString('default', { month: 'short' })}`,
      icon: FileSpreadsheet,
      iconBg: 'bg-violet-50',
      iconColor: 'text-violet-500',
      href: '/admin/paysheets'
    },
    {
      title: 'Absent Today',
      value: absentCount.toString(),
      subtitle: 'Scheduled but not in',
      icon: UserX,
      iconBg: 'bg-slate-100',
      iconColor: 'text-slate-500',
      href: '/admin/attendance'
    },
  ]

  return (
    <div className="animate-fade-in space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">
          Welcome back, {session?.user?.name ?? 'Admin'} 👋
        </h1>
        <p className="text-slate-500 mt-1">
          Here&apos;s what&apos;s happening across your shops today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon
          return (
            <Link key={card.title} href={card.href}>
              <div
                className="group relative bg-white border border-slate-200 rounded-2xl p-5 transition-all duration-300 hover:border-blue-200 hover:-translate-y-0.5 hover:shadow-lg cursor-pointer h-full"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-500">
                      {card.title}
                    </p>
                    <p className="text-3xl font-bold text-slate-900 tracking-tight">
                      {card.value}
                    </p>
                    <p className="text-xs text-slate-400">{card.subtitle}</p>
                  </div>
                  <div
                    className={`flex items-center justify-center w-12 h-12 rounded-xl ${card.iconBg} transition-transform duration-300 group-hover:scale-110`}
                  >
                    <Icon className={`w-6 h-6 ${card.iconColor}`} />
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Recent Attendance Activity</h3>
          {recentLogs.length === 0 ? (
             <p className="text-sm text-slate-400 text-center p-4">No recent clock logs.</p>
          ) : (
            <div className="space-y-4">
              {recentLogs.map(log => (
                <div key={log.id} className="flex justify-between items-center text-sm border-b border-slate-100 pb-2 last:border-0">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${log.type === 'IN' ? 'bg-green-500' : 'bg-orange-500'}`} />
                    <span className="font-medium text-slate-700">{log.user.name}</span>
                    <span className="text-slate-400">clocked {log.type.toLowerCase()}</span>
                  </div>
                  <span className="text-xs text-slate-400">
                    {new Date(log.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' })}
                  </span>
                </div>
              ))}
              <Link href="/admin/attendance" className="block text-center text-sm text-blue-500 hover:underline mt-2">
                View all logs &rarr;
              </Link>
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Recent Leave Requests</h3>
          {recentLeaves.length === 0 ? (
             <p className="text-sm text-slate-400 text-center p-4">No recent leave requests.</p>
          ) : (
            <div className="space-y-4">
              {recentLeaves.map(req => (
                <div key={req.id} className="flex justify-between items-center text-sm border-b border-slate-100 pb-2 last:border-0">
                  <div>
                    <p className="font-medium text-slate-700">{req.user.name}</p>
                    <p className="text-xs text-slate-400">{req.leaveType.name} - {req.totalDays} day(s)</p>
                  </div>
                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                    req.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700' :
                    req.status === 'REJECTED' ? 'bg-red-50 text-red-700' :
                    'bg-amber-50 text-amber-700'
                  }`}>
                    {req.status}
                  </div>
                </div>
              ))}
              <Link href="/admin/leave" className="block text-center text-sm text-blue-500 hover:underline mt-2">
                View all leaves &rarr;
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
