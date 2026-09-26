'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Calendar, Clock, AlertTriangle, CheckCircle2, Wifi, MapPin, Check, X, Clock8, Moon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type DailyAttendance = {
  id: string
  userId: string
  date: string
  clockIn: string | null
  clockOut: string | null
  status: 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'LEAVE'
  isLate: boolean
  lateMinutes: number
  isHalfDay: boolean
  otHours: number
  overrideNote: string | null
  user: { name: string, email: string, shop: { name: string } | null }
}

export default function AdminAttendancePage() {
  const today = new Date().toISOString().split('T')[0]
  const [filterDate, setFilterDate] = useState(today)

  const { data: records = [], isLoading } = useQuery<DailyAttendance[]>({
    queryKey: ['dailyAttendance', filterDate],
    queryFn: async () => {
      const res = await fetch(`/api/hrms/attendance?date=${filterDate}`)
      if (!res.ok) throw new Error('Failed to fetch attendance')
      return res.json()
    },
    refetchInterval: 30000 // Refetch every 30 seconds for live updates
  })

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Daily Attendance (HRMS)</h1>
          <p className="text-slate-500 text-sm mt-1">Monitor real-time attendance, lateness, and overtime across all shops.</p>
        </div>
        <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200 w-full sm:w-auto">
          <Calendar className="w-5 h-5 text-slate-400 ml-2 shrink-0" />
          <input 
            type="date" 
            className="bg-transparent border-none focus:ring-0 text-sm font-medium text-slate-700 w-full outline-none px-2 py-1"
            value={filterDate}
            onChange={e => setFilterDate(e.target.value)}
          />
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
          <CardTitle className="text-lg font-bold text-slate-900">Attendance Records</CardTitle>
          <CardDescription>Viewing records for {new Date(filterDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : records.length === 0 ? (
            <div className="text-center p-16 text-slate-400 bg-slate-50/30">
              <Clock className="w-12 h-12 mx-auto mb-4 opacity-20 text-slate-500" />
              <h3 className="text-lg font-semibold text-slate-900">No attendance data</h3>
              <p className="text-sm text-slate-500 mt-1">No employees have logged attendance for this date yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {records.map(record => {
                const inTime = record.clockIn ? new Date(record.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'
                const outTime = record.clockOut ? new Date(record.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'
                
                return (
                  <div 
                    key={record.id} 
                    className={`flex flex-col lg:flex-row lg:items-center justify-between p-6 transition-colors hover:bg-slate-50/50 ${record.status === 'ABSENT' ? 'bg-red-50/30' : 'bg-white'}`}
                  >
                    <div className="flex items-start gap-4 mb-4 lg:mb-0">
                      <div className={`mt-0.5 rounded-2xl p-3 shadow-sm ${record.status === 'PRESENT' ? 'bg-emerald-50 text-emerald-600' : record.status === 'HALF_DAY' ? 'bg-orange-50 text-orange-600' : record.status === 'LEAVE' ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}`}>
                        {record.status === 'PRESENT' ? <CheckCircle2 className="w-5 h-5" /> : record.status === 'HALF_DAY' ? <Clock8 className="w-5 h-5" /> : record.status === 'LEAVE' ? <Moon className="w-5 h-5" /> : <X className="w-5 h-5" />}
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <h4 className="font-bold text-slate-900 text-lg">{record.user.name}</h4>
                          <Badge variant="outline" className={record.status === 'PRESENT' ? 'border-emerald-200 text-emerald-700 bg-emerald-50' : record.status === 'HALF_DAY' ? 'border-orange-200 text-orange-700 bg-orange-50' : 'border-slate-200 text-slate-700'}>
                            {record.status.replace('_', ' ')}
                          </Badge>
                          {record.isLate && (
                            <Badge variant="destructive" className="flex items-center gap-1 font-semibold text-[10px] uppercase tracking-wider">
                              <AlertTriangle className="w-3 h-3" /> Late ({record.lateMinutes}m)
                            </Badge>
                          )}
                          {record.otHours > 0 && (
                            <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100 border-none font-semibold text-[10px] uppercase tracking-wider">
                              OT: {record.otHours}h
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                          <span className="flex items-center gap-1.5 font-medium">
                            <MapPin className="w-4 h-4 text-slate-400" />
                            {record.user.shop?.name || 'No Shop Assigned'}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6 bg-slate-50 border border-slate-100 rounded-xl p-3 px-5 w-full lg:w-auto self-start lg:self-auto">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Time In</span>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${record.clockIn ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                          <span className="font-mono font-medium text-slate-700">{inTime}</span>
                        </div>
                      </div>
                      
                      <div className="w-px h-8 bg-slate-200 hidden sm:block"></div>
                      
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Time Out</span>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${record.clockOut ? 'bg-orange-500' : 'bg-slate-300'}`}></div>
                          <span className="font-mono font-medium text-slate-700">{outTime}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
