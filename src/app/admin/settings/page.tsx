'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Settings, Save, AlertCircle, Info, Clock, UtensilsCrossed, AlarmClock, LogOut, Timer, Lightbulb, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { formatCurrency } from '@/lib/utils'

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const EXAMPLE_SALARY = 50000

const rs = (n: number) => `Rs ${Math.round(n).toLocaleString('en-LK')}`
const RsIcon = <span className="text-xs font-semibold text-slate-400">Rs</span>

function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number)
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : NaN
}

/** 570 -> "9:30 AM" */
function clock(mins: number) {
  const m = ((Math.round(mins) % 1440) + 1440) % 1440
  const h = Math.floor(m / 60)
  return `${h % 12 || 12}:${String(m % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

function duration(mins: number) {
  const h = Math.floor(mins / 60)
  const m = Math.round(mins % 60)
  return [h ? `${h} h` : '', m ? `${m} min` : ''].filter(Boolean).join(' ') || '0 min'
}

type Rules = {
  start: string, end: string, grace: number, lateFee: number, halfDayAfter: number,
  minHours: number, otRate: number, offDays: number[], threshold: number, penaltyAmount: number,
}

/** Worked examples and warnings for the rules as currently entered (mirrors lib/attendance.ts). */
function explainRules(r: Rules) {
  const start = toMinutes(r.start)
  const end = toMinutes(r.end)
  const shift = end - start
  const daily = EXAMPLE_SALARY / 30
  const examples: { title: string, outcome: string, tone: 'ok' | 'warn' | 'bad' | 'good' }[] = []
  const warnings: string[] = []

  if (!Number.isFinite(shift) || shift <= 0) {
    warnings.push('Shift end must be later than shift start.')
    return { examples, warnings, shift: 0, daily }
  }

  examples.push({
    title: `Arrives by ${clock(start + r.grace)}`,
    outcome: r.grace > 0 ? `On time (${r.grace} min grace after ${clock(start)}). No deduction.` : 'On time. No deduction.',
    tone: 'ok',
  })

  if (r.grace < r.halfDayAfter) {
    examples.push({
      title: `Arrives ${clock(start + r.grace + 1)} – ${clock(start + r.halfDayAfter)}`,
      outcome: `Late. Late fee of ${rs(r.lateFee)} for that day.`,
      tone: 'warn',
    })
  }
  examples.push({
    title: `Arrives after ${clock(start + Math.max(r.grace, r.halfDayAfter))}`,
    outcome: `Half day: loses half a day's pay (${rs(daily / 2)} on a ${rs(EXAMPLE_SALARY)} salary) plus the ${rs(r.lateFee)} late fee.`,
    tone: 'bad',
  })
  examples.push({
    title: `Works less than ${r.minHours} h (clock in → clock out)`,
    outcome: `Half day: loses half a day's pay.`,
    tone: 'bad',
  })
  examples.push({
    title: 'Forgets to clock out',
    outcome: 'Shift is closed automatically at midnight and the day counts as a half day.',
    tone: 'bad',
  })
  examples.push({
    title: `Leaves at ${clock(end + 70)}`,
    outcome: `1 h overtime → ${rs(r.otRate)}. Overtime starts once someone stays more than 30 min after ${clock(end)}, counted in half hours.`,
    tone: 'good',
  })
  examples.push({
    title: 'Absent with no approved leave',
    outcome: `Loses a full day's pay (${rs(daily)} on a ${rs(EXAMPLE_SALARY)} salary = salary ÷ 30).`,
    tone: 'bad',
  })
  if (r.offDays.length > 0) {
    examples.push({
      title: [...r.offDays].sort((a, b) => a - b).map(d => DAY_LABELS[d]).join(' & '),
      outcome: 'Day off. Not counted as absent, and not counted in leave requests.',
      tone: 'ok',
    })
  }

  if (r.grace >= r.halfDayAfter) {
    warnings.push(
      `The grace period (${r.grace} min) is not shorter than "half day after" (${r.halfDayAfter} min), so anyone who is late is immediately a half day. ` +
      `Usually the grace period is short (e.g. 15 min) and the half-day limit longer (e.g. 60–120 min).`
    )
  }
  if (r.minHours * 60 > shift) {
    warnings.push(`Minimum hours for a full day (${r.minHours} h) is longer than the shift (${duration(shift)}), so every day would be a half day.`)
  } else if (r.minHours * 60 < shift / 2) {
    warnings.push(`With a shift of ${duration(shift)}, someone can leave after only ${r.minHours} h and still be paid a full day. Consider a higher minimum.`)
  }
  if (r.offDays.length === 7) warnings.push('Every day is marked as a day off.')

  return { examples, warnings, shift, daily }
}

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
  const [lunchDurationMins, setLunchDurationMins] = useState('60')
  const [lunchPenaltyPoints, setLunchPenaltyPoints] = useState('1')

  const { data: settings } = useQuery({
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
      if (settings.LUNCH_DURATION_MINS) setLunchDurationMins(settings.LUNCH_DURATION_MINS)
      if (settings.LUNCH_PENALTY_POINTS) setLunchPenaltyPoints(settings.LUNCH_PENALTY_POINTS)
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
          LUNCH_DURATION_MINS: lunchDurationMins,
          LUNCH_PENALTY_POINTS: lunchPenaltyPoints,
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
    onError: (err: Error) => toast.error(err.message)
  })

  const threshold = Number(penaltyThreshold) || 10
  const amount = Number(penaltyAmount) || 1000

  const { examples, warnings, shift } = explainRules({
    start: shiftStartTime,
    end: shiftEndTime,
    grace: Number(lateGracePeriodMins) || 0,
    lateFee: Number(latePenaltyAmount) || 0,
    halfDayAfter: Number(maxLateMinsForHalfDay) || 0,
    minHours: Number(minHoursForFullDay) || 0,
    otRate: Number(otRatePerHour) || 0,
    offDays: weeklyOffDays,
    threshold,
    penaltyAmount: amount,
  })

  const toneStyles = {
    ok: 'border-slate-200 bg-white',
    good: 'border-emerald-200 bg-emerald-50/60',
    warn: 'border-amber-200 bg-amber-50/60',
    bad: 'border-red-200 bg-red-50/50',
  }

  const sectionTitle = 'font-semibold text-slate-900 flex items-center gap-2'
  const sectionText = 'text-sm text-slate-500 mt-1 mb-4'
  const hint = 'text-xs text-slate-500 mt-1.5'

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Settings className="w-6 h-6 text-blue-500" /> Settings
          </h1>
          <p className="text-slate-500 text-sm mt-1">Working hours and the pay rules applied when paysheets are generated.</p>
        </div>
        <Button
          onClick={() => saveMutation.mutate()}
          isLoading={saveMutation.isPending}
          className="shadow-lg shadow-blue-500/20"
        >
          <Save className="w-4 h-4 mr-2" /> Save All Changes
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        <div className="lg:col-span-3 space-y-6">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100">
              <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-500" /> Attendance rules
              </CardTitle>
              <CardDescription>How clock-in and clock-out times turn into a full day, half day, late fee or overtime.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 divide-y divide-slate-100">
              <section className="pb-6">
                <h3 className={sectionTitle}><Clock className="w-4 h-4 text-slate-400" /> Working hours</h3>
                <p className={sectionText}>The normal shift for every shop.{shift > 0 && ` Currently ${duration(shift)} a day.`}</p>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Shift starts" type="time" required value={shiftStartTime} onChange={(e) => setShiftStartTime(e.target.value)} />
                  <Input label="Shift ends" type="time" required value={shiftEndTime} onChange={(e) => setShiftEndTime(e.target.value)} />
                </div>
                <div className="mt-5">
                  <p className="text-sm font-medium text-slate-700 mb-2">Days off each week</p>
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
                  <p className={hint}>Nobody is marked absent on these days, and they are skipped when counting leave.</p>
                </div>
              </section>

              <section className="py-6">
                <h3 className={sectionTitle}><AlarmClock className="w-4 h-4 text-slate-400" /> Arriving late</h3>
                <p className={sectionText}>Measured from the shift start to the first clock-in of the day.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Input label="Grace period (minutes)" type="number" min="0" required value={lateGracePeriodMins} onChange={(e) => setLateGracePeriodMins(e.target.value)} placeholder="e.g. 15" />
                    <p className={hint}>Arriving within this time is not late.</p>
                  </div>
                  <div>
                    <Input label="Late fee per late day" type="number" min="0" required value={latePenaltyAmount} onChange={(e) => setLatePenaltyAmount(e.target.value)} icon={RsIcon} placeholder="e.g. 500" />
                    <p className={hint}>Deducted once for each day someone is late.</p>
                  </div>
                  <div className="sm:col-span-2">
                    <Input label="Half day if later than (minutes)" type="number" min="0" required value={maxLateMinsForHalfDay} onChange={(e) => setMaxLateMinsForHalfDay(e.target.value)} placeholder="e.g. 120" />
                    <p className={hint}>Arriving more than this many minutes after the shift start counts as a half day. Should be longer than the grace period.</p>
                  </div>
                </div>
              </section>

              <section className="py-6">
                <h3 className={sectionTitle}><LogOut className="w-4 h-4 text-slate-400" /> Leaving early</h3>
                <p className={sectionText}>Time worked is first clock-in to last clock-out.</p>
                <Input label="Minimum hours for a full day" type="number" min="1" max="24" required value={minHoursForFullDay} onChange={(e) => setMinHoursForFullDay(e.target.value)} placeholder="e.g. 8" />
                <p className={hint}>Working fewer hours than this counts as a half day. Forgetting to clock out also counts as a half day.</p>
              </section>

              <section className="pt-6">
                <h3 className={sectionTitle}><Timer className="w-4 h-4 text-slate-400" /> Overtime</h3>
                <p className={sectionText}>Starts when someone stays more than 30 minutes after the shift ends, and is counted in half hours.</p>
                <Input label="Overtime pay per hour" type="number" min="0" required value={otRatePerHour} onChange={(e) => setOtRatePerHour(e.target.value)} icon={RsIcon} />
              </section>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100">
              <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <UtensilsCrossed className="w-5 h-5 text-amber-500" /> Lunch break
              </CardTitle>
              <CardDescription>Employees tap Lunch In to start their break and Lunch Out (on the shop WiFi) when they return.</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Lunch length (minutes)" type="number" min="5" max="240" required value={lunchDurationMins} onChange={(e) => setLunchDurationMins(e.target.value)} placeholder="e.g. 60" />
                <Input label="Penalty points if late back" type="number" min="0" max="100" required value={lunchPenaltyPoints} onChange={(e) => setLunchPenaltyPoints(e.target.value)} placeholder="e.g. 1" />
              </div>
              <p className={hint + ' mt-3'}>
                If Lunch Out is not tapped in time, the points are added once and you are notified in the app and by email. Set points to 0 to only be notified.
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100">
              <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-500" /> Penalty points
              </CardTitle>
              <CardDescription>
                Employees get 1 point for each missed work check, and the points above for coming back late from lunch.
                Points turn into a salary deduction on the next paysheet.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Input label="Points per deduction" type="number" min="1" required value={penaltyThreshold} onChange={(e) => setPenaltyThreshold(e.target.value)} />
                  <p className={hint}>Every time an employee reaches this many points…</p>
                </div>
                <div>
                  <Input label="…this amount is deducted" type="number" min="0" required value={penaltyAmount} onChange={(e) => setPenaltyAmount(e.target.value)} icon={RsIcon} />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5" /> Examples
                </h4>
                <div className="space-y-1 text-sm text-slate-600">
                  <p><strong className="text-slate-900">{threshold - 1}</strong> points → <strong className="text-emerald-600">{formatCurrency(0)}</strong> deducted, points carry over to next month</p>
                  <p><strong className="text-slate-900">{threshold}</strong> points → <strong className="text-red-600">{formatCurrency(amount)}</strong> deducted</p>
                  <p><strong className="text-slate-900">{threshold * 2 + 5}</strong> points → <strong className="text-red-600">{formatCurrency(amount * 2)}</strong> deducted, 5 points carry over</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="lg:col-span-2 lg:sticky lg:top-6 space-y-4">
          <Card className="border-blue-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold text-blue-900 flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-blue-500" /> What this means
              </CardTitle>
              <CardDescription>Worked out from the values on the left, before saving.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {warnings.map(w => (
                <div key={w} className="flex gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                  <p>{w}</p>
                </div>
              ))}
              <ul className="space-y-2">
                {examples.map(ex => (
                  <li key={ex.title} className={`rounded-xl border p-3 ${toneStyles[ex.tone]}`}>
                    <p className="text-sm font-semibold text-slate-900">{ex.title}</p>
                    <p className="text-sm text-slate-600 mt-0.5">{ex.outcome}</p>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-slate-500">
                Pay is worked out per day as salary ÷ 30. Examples use a {formatCurrency(EXAMPLE_SALARY)} monthly salary.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}
