'use client'

import { useState, useEffect } from 'react'
import { Download, FileSpreadsheet, TrendingUp, Users, CalendarDays } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

type ReportClientProps = {
  attendanceStats: any[]
  employeeNames: string[]
}

export function ReportClient({ attendanceStats, employeeNames }: ReportClientProps) {
  const today = new Date()
  const [filterMonth, setFilterMonth] = useState(today.getMonth() + 1)
  const [filterYear, setFilterYear] = useState(today.getFullYear())
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const handleExport = () => {
    window.location.href = `/api/paysheets/export?month=${filterMonth}&year=${filterYear}`
  }

  return (
    <div className="space-y-6">
      
      <div className="grid grid-cols-1 gap-6">

        {/* Attendance Trends */}
        <Card className="border-slate-200 shadow-sm overflow-hidden bg-white lg:col-span-2">
          <CardHeader className="border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              <CardTitle className="text-lg font-bold text-slate-900">Attendance Trends (Last 7 Days)</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6 h-[300px]">
            {isMounted ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={attendanceStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(val) => `${val}h`} />
                  <RechartsTooltip cursor={{ stroke: '#f1f5f9', strokeWidth: 2 }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(value: any) => [`${value} hrs`, undefined]} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                  {employeeNames.map((name, idx) => (
                    <Line 
                      key={name}
                      type="monotone" 
                      dataKey={name} 
                      name={name} 
                      stroke={COLORS[idx % COLORS.length]} 
                      strokeWidth={3} 
                      dot={{ r: 4, strokeWidth: 2 }} 
                      activeDot={{ r: 6 }} 
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400">Loading chart...</div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* Export Section */}
      <Card className="border-slate-200 shadow-sm overflow-hidden relative mt-8">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
          <FileSpreadsheet className="w-48 h-48 text-emerald-900" />
        </div>
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl shadow-sm border border-emerald-100">
              <FileSpreadsheet className="w-8 h-8" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-slate-900">Payroll Export (Excel)</CardTitle>
              <CardDescription className="text-slate-500 mt-1 text-sm">Download a comprehensive spreadsheet of all paysheets for a given month.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 p-6 md:p-8 relative z-10 bg-white">
          <div className="flex flex-col sm:flex-row gap-6">
            <div className="space-y-2 flex-1">
              <label className="text-sm font-semibold text-slate-700">Month</label>
              <select 
                className="w-full p-3 rounded-xl border border-slate-200 bg-white text-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none"
                value={filterMonth} 
                onChange={(e) => setFilterMonth(Number(e.target.value))}
              >
                {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>{new Date(2000, m - 1).toLocaleString('default', { month: 'long' })}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2 flex-1">
              <label className="text-sm font-semibold text-slate-700">Year</label>
              <input 
                type="number" 
                className="w-full p-3 rounded-xl border border-slate-200 bg-white text-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none"
                value={filterYear}
                onChange={(e) => setFilterYear(Number(e.target.value))}
              />
            </div>
          </div>
          
          <Button 
            className="w-full mt-4 h-12 bg-emerald-500 hover:bg-emerald-600 text-white font-bold shadow-lg shadow-emerald-500/20 text-md rounded-xl" 
            onClick={handleExport}
          >
            <Download className="w-5 h-5 mr-2" /> Download Excel File
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
