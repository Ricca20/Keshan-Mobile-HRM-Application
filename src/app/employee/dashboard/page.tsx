import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Clock, Calendar, TreePalm, Receipt, ArrowRight, Sparkles, MapPin } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'

export default async function EmployeeDashboard() {
  const session = await auth()
  const userId = session?.user?.id

  if (!userId) return null

  // 1. Current Clock Status
  const lastLog = await prisma.clockLog.findFirst({
    where: { userId, isValid: true },
    orderBy: { timestamp: 'desc' },
    include: { shop: true }
  })
  const isClockedIn = lastLog?.type === 'IN'
  const shopName = lastLog?.shop?.name || 'Assigned Shop'

  // 2. This Week's Attendance (Clock Ins in last 7 days)
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const recentDays = await prisma.clockLog.count({
    where: {
      userId,
      type: 'IN',
      timestamp: { gte: sevenDaysAgo }
    }
  })

  // 3. Leave Left
  const currentYear = new Date().getFullYear()
  const balances = await prisma.leaveBalance.findMany({
    where: { userId, year: currentYear }
  })
  let totalLeaveDays = 0
  let usedLeaveDays = 0
  balances.forEach(b => {
    totalLeaveDays += b.totalDays
    usedLeaveDays += b.usedDays
  })
  const remainingLeave = totalLeaveDays - usedLeaveDays

  // 4. Latest Paysheet
  const latestPaysheet = await prisma.paySheet.findFirst({
    where: { userId, status: 'FINALIZED' },
    orderBy: [{ year: 'desc' }, { month: 'desc' }]
  })

  const firstName = session?.user?.name?.split(' ')[0] ?? 'there'

  return (
    <div className="animate-fade-in space-y-6 max-w-5xl mx-auto pt-4 pb-24">
      
      {/* Hero Greeting Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-8 sm:p-10 text-white shadow-xl shadow-blue-900/20 border border-blue-500/30">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none transform translate-x-8 -translate-y-8">
          <Sparkles className="w-48 h-48" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <p className="text-blue-100 font-medium mb-1 tracking-wide uppercase text-sm">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2">
              Good morning, {firstName}! 👋
            </h1>
            <p className="text-blue-50 max-w-md leading-relaxed opacity-90">
              Ready for a great day at {shopName}? Here's your quick overview for today.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Clock Card (Takes up 1 column on lg, full width on mobile) */}
        <div className="lg:col-span-1">
          <Link href="/employee/clock" className="block h-full">
            <div className={`relative h-full overflow-hidden border-2 rounded-3xl p-8 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 group ${
              isClockedIn 
                ? 'bg-emerald-50 border-emerald-200 hover:border-emerald-300 shadow-emerald-900/5' 
                : 'bg-white border-slate-200 hover:border-blue-300 shadow-slate-900/5'
            }`}>
              {/* Background accent ring */}
              <div className={`absolute -right-12 -top-12 w-40 h-40 rounded-full border-4 opacity-10 pointer-events-none transition-transform group-hover:scale-110 duration-500 ${isClockedIn ? 'border-emerald-500' : 'border-blue-500'}`} />
              
              <div className="flex flex-col items-center text-center h-full justify-center">
                <div className={`relative flex items-center justify-center w-24 h-24 rounded-full mb-6 transition-transform group-hover:scale-105 duration-300 shadow-sm ${
                  isClockedIn 
                    ? 'bg-emerald-500 text-white shadow-emerald-500/30' 
                    : 'bg-slate-100 text-slate-400 border border-slate-200'
                }`}>
                  <Clock className={`w-10 h-10 ${isClockedIn ? 'animate-pulse' : ''}`} />
                  {isClockedIn && (
                    <div className="absolute inset-0 rounded-full border-2 border-emerald-500 animate-ping opacity-20"></div>
                  )}
                </div>
                
                <Badge variant={isClockedIn ? 'success' : 'secondary'} className="mb-3 px-3 py-1 text-xs font-bold uppercase tracking-widest">
                  Live Status
                </Badge>
                
                <p className={`text-3xl font-black tracking-tight mb-2 ${isClockedIn ? 'text-emerald-700' : 'text-slate-900'}`}>
                  {isClockedIn ? 'Clocked In' : 'Not Clocked In'}
                </p>
                
                {isClockedIn && lastLog && (
                  <p className="text-emerald-600/80 text-sm font-medium flex items-center justify-center gap-1.5 mb-6">
                    <MapPin className="w-3.5 h-3.5" /> {shopName}
                  </p>
                )}
                
                <div className={`mt-auto flex items-center justify-center text-sm font-bold w-full py-3 rounded-xl transition-colors ${
                  isClockedIn 
                    ? 'bg-emerald-100 text-emerald-700 group-hover:bg-emerald-200' 
                    : 'bg-blue-50 text-blue-600 group-hover:bg-blue-100'
                }`}>
                  {isClockedIn ? 'Ready to clock out?' : 'Ready to start work?'} <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* Info Grid (Takes up 2 columns on lg) */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
          
          {/* Recent Attendance */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -mr-16 -mt-16 transition-transform group-hover:scale-110 duration-500 z-0"></div>
            <div className="relative z-10 flex flex-col h-full">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-500 text-white shadow-lg shadow-blue-500/20">
                  <Calendar className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Attendance</p>
                  <p className="font-semibold text-slate-900">Past 7 Days</p>
                </div>
              </div>
              <div className="mt-auto">
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-black text-slate-900 tracking-tighter">{recentDays}</span>
                  <span className="text-lg font-medium text-slate-500">days</span>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full mt-4 overflow-hidden">
                  <div className="bg-blue-500 h-full rounded-full" style={{ width: `${Math.min((recentDays / 5) * 100, 100)}%` }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* Leave Left */}
          <Link href="/employee/leave" className="block">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:border-amber-300 hover:shadow-md transition-all relative overflow-hidden group h-full">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 rounded-bl-full -mr-16 -mt-16 transition-transform group-hover:scale-110 duration-500 z-0"></div>
              <div className="relative z-10 flex flex-col h-full">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-400 text-white shadow-lg shadow-amber-400/20">
                    <TreePalm className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Time Off</p>
                    <p className="font-semibold text-slate-900">Leave Balance</p>
                  </div>
                </div>
                <div className="mt-auto">
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-black text-slate-900 tracking-tighter">{remainingLeave}</span>
                    <span className="text-lg font-medium text-slate-500">days</span>
                  </div>
                  <div className="flex items-center text-sm font-bold text-amber-600 mt-4 group-hover:text-amber-700 transition-colors">
                    Request Leave <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            </div>
          </Link>

          {/* Latest Paysheet (Full width within its grid area) */}
          <div className="sm:col-span-2">
            <Link href="/employee/paysheet" className="block">
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:border-emerald-300 hover:shadow-md transition-all relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-bl-full -mr-16 -mt-16 transition-transform group-hover:scale-110 duration-500 z-0"></div>
                <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-900 text-white shadow-lg shadow-slate-900/20 shrink-0">
                      <Receipt className="w-7 h-7" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Payroll</p>
                      <p className="font-bold text-slate-900 text-lg">Latest Paysheet</p>
                    </div>
                  </div>
                  
                  <div className="sm:text-right mt-2 sm:mt-0">
                    {latestPaysheet ? (
                      <>
                        <div className="flex items-baseline gap-1 sm:justify-end">
                          <span className="text-xl font-bold text-slate-400">Rs.</span>
                          <span className="text-3xl font-black text-slate-900 tracking-tight">{latestPaysheet.netPay.toLocaleString()}</span>
                        </div>
                        <p className="text-sm font-medium text-emerald-600 mt-1 bg-emerald-50 inline-flex px-2 py-0.5 rounded-md">
                          {new Date(2000, latestPaysheet.month - 1).toLocaleString('default', { month: 'short' })} {latestPaysheet.year}
                        </p>
                      </>
                    ) : (
                      <p className="text-xl font-bold text-slate-400 mt-1">No paysheets yet</p>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          </div>
          
        </div>
      </div>
    </div>
  )
}
