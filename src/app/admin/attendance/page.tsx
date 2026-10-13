'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Calendar, Clock, AlertTriangle, CheckCircle2, MapPin, X, Clock8, Moon, Pencil, Plus, RotateCcw, UtensilsCrossed } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'

type Status = 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'LEAVE'

type DailyAttendance = {
  id: string
  userId: string
  date: string
  clockIn: string | null
  clockOut: string | null
  status: Status
  isLate: boolean
  lateMinutes: number
  isHalfDay: boolean
  otHours: number
  overrideNote: string | null
  updatedBy: string | null
  lunch: { startedAt: string, dueAt: string, endedAt: string | null, isOverdue: boolean } | null
  user: { name: string, email: string, shop: { name: string } | null }
}

type Employee = { id: string, name: string, isActive: boolean }

type EditForm = {
  userId: string
  status: Status
  clockIn: string
  clockOut: string
  note: string
  isNew: boolean
}

const TZ = 'Asia/Colombo'

/** 'HH:mm' in Colombo time, for the time inputs. */
function colomboHHmm(iso: string | null) {
  return iso ? new Date(iso).toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }) : ''
}

async function sendAttendance(method: 'PUT' | 'DELETE', body: object) {
  const res = await fetch('/api/hrms/attendance', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

export default function AdminAttendancePage() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: TZ })
  const [filterDate, setFilterDate] = useState(today)
  const [form, setForm] = useState<EditForm | null>(null)
  const queryClient = useQueryClient()
  const toast = useToast()

  const { data: records = [], isLoading } = useQuery<DailyAttendance[]>({
    queryKey: ['dailyAttendance', filterDate],
    queryFn: async () => {
      const res = await fetch(`/api/hrms/attendance?date=${filterDate}`)
      if (!res.ok) throw new Error('Failed to fetch attendance')
      return res.json()
    },
    refetchInterval: 30000 // Refetch every 30 seconds for live updates
  })

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ['employees'],
    queryFn: async () => {
      const res = await fetch('/api/employees')
      if (!res.ok) throw new Error('Failed to fetch employees')
      return res.json()
    },
    enabled: form?.isNew === true,
  })

  const onSaved = (message: string) => {
    queryClient.invalidateQueries({ queryKey: ['dailyAttendance'] })
    toast.success(message)
    setForm(null)
  }

  const saveMutation = useMutation({
    mutationFn: (f: EditForm) => {
      const worked = f.status === 'PRESENT' || f.status === 'HALF_DAY'
      return sendAttendance('PUT', {
        userId: f.userId,
        date: filterDate,
        status: f.status,
        clockIn: worked && f.clockIn ? f.clockIn : null,
        clockOut: worked && f.clockOut ? f.clockOut : null,
        note: f.note,
      })
    },
    onSuccess: () => onSaved('Attendance updated'),
    onError: (err: Error) => toast.error(err.message),
  })

  const resetMutation = useMutation({
    mutationFn: (userId: string) => sendAttendance('DELETE', { userId, date: filterDate }),
    onSuccess: () => onSaved('Correction removed; recalculated from clock logs'),
    onError: (err: Error) => toast.error(err.message),
  })

  const openEdit = (record: DailyAttendance) => setForm({
    userId: record.userId,
    status: record.status,
    clockIn: colomboHHmm(record.clockIn),
    clockOut: colomboHHmm(record.clockOut),
    note: record.overrideNote ?? '',
    isNew: false,
  })

  const editing = form && !form.isNew ? records.find(r => r.userId === form.userId) : undefined
  const missingEmployees = employees.filter(e => e.isActive && !records.some(r => r.userId === e.id))
  const showTimes = form?.status === 'PRESENT' || form?.status === 'HALF_DAY'

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
            max={today}
            onChange={e => setFilterDate(e.target.value)}
          />
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg font-bold text-slate-900">Attendance Records</CardTitle>
              <CardDescription>Viewing records for {new Date(`${filterDate}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setForm({ userId: '', status: 'PRESENT', clockIn: '', clockOut: '', note: '', isNew: true })}
            >
              <Plus className="w-4 h-4 mr-1.5" /> Add Record
            </Button>
          </div>
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
                const inTime = colomboHHmm(record.clockIn) || '--:--'
                const outTime = colomboHHmm(record.clockOut) || '--:--'
                
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
                          {record.updatedBy && (
                            <Badge variant="outline" className="border-amber-200 text-amber-700 bg-amber-50 text-[10px] uppercase tracking-wider">
                              Edited by admin
                            </Badge>
                          )}
                          {record.lunch?.isOverdue && (
                            <Badge variant="destructive" className="flex items-center gap-1 font-semibold text-[10px] uppercase tracking-wider">
                              <UtensilsCrossed className="w-3 h-3" /> Lunch overdue
                            </Badge>
                          )}
                        </div>
                        {record.updatedBy && record.overrideNote && (
                          <p className="text-xs text-slate-500 italic">Note: {record.overrideNote}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                          <span className="flex items-center gap-1.5 font-medium">
                            <MapPin className="w-4 h-4 text-slate-400" />
                            {record.user.shop?.name || 'No Shop Assigned'}
                          </span>
                          {record.lunch && (
                            <span className="flex items-center gap-1.5 font-medium">
                              <UtensilsCrossed className="w-4 h-4 text-slate-400" />
                              Lunch {colomboHHmm(record.lunch.startedAt)} – {record.lunch.endedAt ? colomboHHmm(record.lunch.endedAt) : 'not back yet'}
                              <span className="text-slate-400">(due {colomboHHmm(record.lunch.dueAt)})</span>
                            </span>
                          )}
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

                      <div className="w-px h-8 bg-slate-200 hidden sm:block"></div>

                      <Button size="sm" variant="ghost" onClick={() => openEdit(record)} aria-label={`Edit attendance for ${record.user.name}`}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Modal
        isOpen={form !== null}
        onClose={() => setForm(null)}
        title={form?.isNew ? 'Add Attendance Record' : `Edit Attendance — ${editing?.user.name ?? ''}`}
      >
        {form && (
          <form
            className="space-y-4"
            onSubmit={e => { e.preventDefault(); saveMutation.mutate(form) }}
          >
            {form.isNew && (
              <div className="space-y-1.5">
                <label htmlFor="att-employee" className="block text-sm font-medium text-slate-700">Employee</label>
                <select
                  id="att-employee"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                  value={form.userId}
                  onChange={e => setForm({ ...form, userId: e.target.value })}
                >
                  <option value="">Select employee…</option>
                  {missingEmployees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
                {missingEmployees.length === 0 && employees.length > 0 && (
                  <p className="text-xs text-slate-500">Every active employee already has a record for this date. Edit it from the list instead.</p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="att-status" className="block text-sm font-medium text-slate-700">Status</label>
              <select
                id="att-status"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                value={form.status}
                onChange={e => setForm({ ...form, status: e.target.value as Status })}
              >
                <option value="PRESENT">Present</option>
                <option value="HALF_DAY">Half Day</option>
                <option value="ABSENT">Absent</option>
                <option value="LEAVE">Leave</option>
              </select>
            </div>

            {showTimes && (
              <div className="grid grid-cols-2 gap-3">
                <Input id="att-in" label="Time In" type="time" required value={form.clockIn} onChange={e => setForm({ ...form, clockIn: e.target.value })} />
                <Input id="att-out" label="Time Out" type="time" value={form.clockOut} onChange={e => setForm({ ...form, clockOut: e.target.value })} />
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="att-note" className="block text-sm font-medium text-slate-700">Reason for correction</label>
              <textarea
                id="att-note"
                required
                minLength={3}
                maxLength={500}
                rows={2}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                value={form.note}
                onChange={e => setForm({ ...form, note: e.target.value })}
              />
            </div>

            <p className="text-xs text-slate-500">
              Times are Sri Lanka time. Late and OT are recalculated from them. Edited records are not changed by the automatic
              daily processing. Regenerate draft paysheets afterwards so payroll picks up the change.
            </p>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2 pt-2">
              {editing?.updatedBy ? (
                <Button
                  type="button"
                  variant="ghost"
                  isLoading={resetMutation.isPending}
                  onClick={() => resetMutation.mutate(form.userId)}
                >
                  <RotateCcw className="w-4 h-4 mr-1.5" /> Reset to clock logs
                </Button>
              ) : <span />}
              <Button type="submit" isLoading={saveMutation.isPending} disabled={!form.userId}>
                Save
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
