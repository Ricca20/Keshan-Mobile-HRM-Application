'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Settings, Save, AlertCircle, Info, Clock, CalendarDays, DollarSign } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { formatCurrency } from '@/lib/utils'

export default function AdminSettingsPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  
  // Existing settings
  const [penaltyThreshold, setPenaltyThreshold] = useState('10')
  const [penaltyAmount, setPenaltyAmount] = useState('1000')

  // HRMS New Settings
  const [shiftStartTime, setShiftStartTime] = useState('09:00')
  const [shiftEndTime, setShiftEndTime] = useState('18:00')
  const [lateGracePeriodMins, setLateGracePeriodMins] = useState('15')
  const [latePenaltyAmount, setLatePenaltyAmount] = useState('500')
  const [maxLateMinsForHalfDay, setMaxLateMinsForHalfDay] = useState('60')
  const [minHoursForFullDay, setMinHoursForFullDay] = useState('4')
  const [otRatePerHour, setOtRatePerHour] = useState('1000')
  const [weeklyOffDays, setWeeklyOffDays] = useState<number[]>([0, 6])

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await fetch('/api/settings')
      if (!res.ok) throw new Error('Failed to fetch settings')
      return res.json()
    }
  })

  useEffect(() => {
    if (settings) {
      if (settings.PENALTY_THRESHOLD) setPenaltyThreshold(settings.PENALTY_THRESHOLD)
      if (settings.PENALTY_AMOUNT) setPenaltyAmount(settings.PENALTY_AMOUNT)
      if (settings.SHIFT_START_TIME) setShiftStartTime(settings.SHIFT_START_TIME)
      if (settings.SHIFT_END_TIME) setShiftEndTime(settings.SHIFT_END_TIME)
      if (settings.LATE_GRACE_PERIOD_MINS) setLateGracePeriodMins(settings.LATE_GRACE_PERIOD_MINS)
      if (settings.LATE_PENALTY_AMOUNT) setLatePenaltyAmount(settings.LATE_PENALTY_AMOUNT)
      if (settings.MAX_LATE_MINS_FOR_HALF_DAY) setMaxLateMinsForHalfDay(settings.MAX_LATE_MINS_FOR_HALF_DAY)
      if (settings.MIN_HOURS_FOR_FULL_DAY) setMinHoursForFullDay(settings.MIN_HOURS_FOR_FULL_DAY)
      if (settings.OT_RATE_PER_HOUR) setOtRatePerHour(settings.OT_RATE_PER_HOUR)
      if (typeof settings.WEEKLY_OFF_DAYS === 'string') {
        setWeeklyOffDays(settings.WEEKLY_OFF_DAYS.split(',').filter(Boolean).map(Number))
      }
      if (typeof settings.WEEKLY_OFF_DAYS === 'string') {
        setWeeklyOffDays(settings.WEEKLY_OFF_DAYS.split(',').filter(Boolean).map(Number))
      }
    }
  }, [settings])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          PENALTY_THRESHOLD: penaltyThreshold,
          PENALTY_AMOUNT: penaltyAmount,
          SHIFT_START_TIME: shiftStartTime,
          SHIFT_END_TIME: shiftEndTime,
          LATE_GRACE_PERIOD_MINS: lateGracePeriodMins,
          LATE_PENALTY_AMOUNT: latePenaltyAmount,
          MAX_LATE_MINS_FOR_HALF_DAY: maxLateMinsForHalfDay,
          MIN_HOURS_FOR_FULL_DAY: minHoursForFullDay,
          OT_RATE_PER_HOUR: otRatePerHour,
          WEEKLY_OFF_DAYS: [...weeklyOffDays].sort().join(','),
        })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to save settings')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      toast.success('Settings saved successfully')
    },
    onError: (err: any) => toast.error(err.message)
  })

  const threshold = Number(penaltyThreshold) || 10
  const amount = Number(penaltyAmount) || 1000

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Settings className="w-6 h-6 text-blue-500" /> System Settings
          </h1>
          <p className="text-slate-500 text-sm mt-1">Configure global application parameters and HRMS rules.</p>
        </div>
        <Button 
          onClick={() => saveMutation.mutate()} 
          isLoading={saveMutation.isPending}
          className="shadow-lg shadow-blue-500/20"
        >
          <Save className="w-4 h-4 mr-2" /> Save All Changes
        </Button>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100">
          <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-500" /> HRMS - Attendance & Shift Settings
          </CardTitle>
          <CardDescription>Configure standard shift hours and late attendance rules for employees.</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-800 border-b pb-2">Standard Shift Timings</h3>
              <div className="grid grid-cols-2 gap-4">
                <Input 
                  label="Shift Start Time"
                  type="time"
                  required
                  value={shiftStartTime}
                  onChange={(e) => setShiftStartTime(e.target.value)}
                />
                <Input 
                  label="Shift End Time"
                  type="time"
                  required
                  value={shiftEndTime}
                  onChange={(e) => setShiftEndTime(e.target.value)}
                />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">Weekly Off Days</p>
                <div className="flex flex-wrap gap-2">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label, day) => {
                    const checked = weeklyOffDays.includes(day)
                    return (
                      <label key={day} className={`px-3 py-1.5 rounded-lg border text-sm cursor-pointer select-none ${checked ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-semibold' : 'border-slate-200 text-slate-600'}`}>
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={checked}
                          onChange={() => setWeeklyOffDays(checked ? weeklyOffDays.filter(d => d !== day) : [...weeklyOffDays, day])}
                        />
                        {label}
                      </label>
                    )
                  })}
                </div>
                <p className="text-xs text-slate-500 mt-2">Days without clock-in on these days are not counted as absent, and are skipped when counting leave days.</p>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-slate-800 border-b pb-2">Overtime (OT)</h3>
              <Input 
                label="OT Rate per Hour (LKR)"
                type="number"
                min="0"
                required
                value={otRatePerHour}
                onChange={(e) => setOtRatePerHour(e.target.value)}
                icon={<DollarSign className="w-4 h-4 text-slate-400" />}
              />
            </div>

            <div className="space-y-4 md:col-span-2">
              <h3 className="font-semibold text-slate-800 border-b pb-2">Late Deductions & Half Days</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <Input 
                    label="Late Grace Period (Mins)"
                    type="number"
                    min="0"
                    required
                    value={lateGracePeriodMins}
                    onChange={(e) => setLateGracePeriodMins(e.target.value)}
                    placeholder="e.g. 15"
                  />
                  <Input 
                    label="Penalty if Late (after grace) (LKR)"
                    type="number"
                    min="0"
                    required
                    value={latePenaltyAmount}
                    onChange={(e) => setLatePenaltyAmount(e.target.value)}
                    placeholder="e.g. 500"
                  />
                </div>
                <div className="space-y-4">
                  <Input 
                    label="Max Late Mins for Half Day"
                    type="number"
                    min="0"
                    required
                    value={maxLateMinsForHalfDay}
                    onChange={(e) => setMaxLateMinsForHalfDay(e.target.value)}
                    placeholder="e.g. 60"
                  />
                  <Input 
                    label="Min Hours for Full Day"
                    type="number"
                    min="1"
                    max="24"
                    required
                    value={minHoursForFullDay}
                    onChange={(e) => setMinHoursForFullDay(e.target.value)}
                    placeholder="e.g. 4"
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100">
          <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" /> Penalty Configuration
          </CardTitle>
          <CardDescription>Configure how missed verification points translate into salary deductions.</CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="max-w-lg space-y-5">
            <Input 
              label="Penalty Point Threshold (points per bulk)"
              type="number"
              min="1"
              required
              value={penaltyThreshold}
              onChange={(e) => setPenaltyThreshold(e.target.value)}
            />

            <Input 
              label="Deduction Amount per Bulk (in LKR)"
              type="number"
              min="0"
              required
              value={penaltyAmount}
              onChange={(e) => setPenaltyAmount(e.target.value)}
            />

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" /> Live Preview
              </h4>
              <div className="space-y-1 text-sm text-slate-600">
                <p>Employee with <strong className="text-slate-900">{threshold - 1}</strong> points → <strong className="text-emerald-600">{formatCurrency(0)}</strong> deducted</p>
                <p>Employee with <strong className="text-slate-900">{threshold}</strong> points → <strong className="text-red-600">{formatCurrency(amount)}</strong> deducted</p>
                <p>Employee with <strong className="text-slate-900">{threshold * 2 + 5}</strong> points → <strong className="text-red-600">{formatCurrency(amount * 2)}</strong> deducted</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
