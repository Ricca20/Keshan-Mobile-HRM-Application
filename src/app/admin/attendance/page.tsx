'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Calendar, Clock, AlertTriangle, CheckCircle2, Wifi, MapPin } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

type ClockLog = {
  id: string
  userId: string
  shopId: string
  type: 'IN' | 'OUT'
  timestamp: string
  isValid: boolean
  flagReason: string | null
  ipAddress: string
  user?: { name: string, email: string }
  shop?: { name: string }
}

export default function AdminAttendancePage() {
  const today = new Date().toISOString().split('T')[0]
  const [filterDate, setFilterDate] = useState(today)

  const { data: logs = [], isLoading } = useQuery<ClockLog[]>({
    queryKey: ['clockLogs', filterDate],
    queryFn: async () => {
      const res = await fetch(`/api/clock/logs?date=${filterDate}`)
      if (!res.ok) throw new Error('Failed to fetch logs')
      return res.json()
    },
    refetchInterval: 30000 // Refetch every 30 seconds for live updates
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Live Attendance</h1>
          <p className="text-slate-500 text-sm mt-1">Monitor real-time clock-in/out logs across all shops.</p>
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
          <CardTitle className="text-lg font-bold text-slate-900">Activity Feed</CardTitle>
          <CardDescription>Viewing logs for {new Date(filterDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center p-16 text-slate-400 bg-slate-50/30">
              <Clock className="w-12 h-12 mx-auto mb-4 opacity-20 text-slate-500" />
              <h3 className="text-lg font-semibold text-slate-900">No activity today</h3>
              <p className="text-sm text-slate-500 mt-1">No employees have clocked in or out on this date.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {Object.values(logs.reduce((acc, log) => {
                if (!acc[log.userId]) {
                  acc[log.userId] = {
                    userId: log.userId,
                    user: log.user,
                    shop: log.shop,
                    inLog: null as ClockLog | null,
                    outLog: null as ClockLog | null,
                    flags: [] as string[]
                  }
                }
                if (log.type === 'IN' && (!acc[log.userId].inLog || new Date(log.timestamp) > new Date(acc[log.userId].inLog!.timestamp))) {
                  acc[log.userId].inLog = log
                }
                if (log.type === 'OUT' && (!acc[log.userId].outLog || new Date(log.timestamp) > new Date(acc[log.userId].outLog!.timestamp))) {
                  acc[log.userId].outLog = log
                }
                if (!log.isValid && log.flagReason) {
                  acc[log.userId].flags.push(log.flagReason)
                }
                return acc
              }, {} as Record<string, any>)).map(record => {
                const inTime = record.inLog ? new Date(record.inLog.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'
                const outTime = record.outLog ? new Date(record.outLog.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'
                const hasFlags = record.flags.length > 0
                
                return (
                  <div 
                    key={record.userId} 
                    className={`flex flex-col lg:flex-row lg:items-center justify-between p-6 transition-colors hover:bg-slate-50/50 ${hasFlags ? 'bg-red-50/30' : 'bg-white'}`}
                  >
                    <div className="flex items-start gap-4 mb-4 lg:mb-0">
                      <div className={`mt-0.5 rounded-2xl p-3 shadow-sm ${record.inLog && record.outLog ? 'bg-blue-50 text-blue-600' : record.inLog ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <h4 className="font-bold text-slate-900 text-lg">{record.user?.name}</h4>
                          {hasFlags && (
                            <Badge variant="destructive" className="flex items-center gap-1 font-semibold text-[10px] uppercase tracking-wider">
                              <AlertTriangle className="w-3 h-3" /> Flagged
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                          <span className="flex items-center gap-1.5 font-medium">
                            <MapPin className="w-4 h-4 text-slate-400" />
                            {record.shop?.name}
                          </span>
                          {record.inLog && (
                            <>
                              <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                              <span className="flex items-center gap-1.5 font-mono text-xs">
                                <Wifi className="w-4 h-4 text-slate-400" />
                                {record.inLog.ipAddress}
                              </span>
                            </>
                          )}
                        </div>
                        {hasFlags && (
                          <div className="mt-3 text-sm font-medium text-red-700 bg-red-100/50 px-3 py-2 rounded-xl border border-red-200 inline-block">
                            {record.flags[0]} {record.flags.length > 1 && `(+${record.flags.length - 1} more)`}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6 bg-slate-50 border border-slate-100 rounded-xl p-3 px-5 w-full lg:w-auto self-start lg:self-auto">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Time In</span>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${record.inLog ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                          <span className="font-mono font-medium text-slate-700">{inTime}</span>
                        </div>
                      </div>
                      
                      <div className="w-px h-8 bg-slate-200 hidden sm:block"></div>
                      
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Time Out</span>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${record.outLog ? 'bg-orange-500' : 'bg-slate-300'}`}></div>
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
