'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Clock, LogIn, LogOut, AlertCircle, CheckCircle2, UtensilsCrossed, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useEffect, useRef, useState } from 'react'

type Lunch = { startedAt: string, dueAt: string, endedAt: string | null, isOverdue: boolean }

type ClockStatus = {
  isClockedIn: boolean
  lastLog: { type: string, timestamp: string, isValid: boolean, flagReason: string } | null
  lunch: Lunch | null
  lunchMinutes: number
  serverTime: string
}

function colomboTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Colombo' })
}

function formatDuration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const sec = total % 60
  const mmss = `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return h > 0 ? `${h}:${mmss}` : mmss
}

class ActionError extends Error {
  constructor(message: string, readonly ip?: string) {
    super(message)
  }
}

/**
 * POSTs a clock/lunch action and turns every failure into a message an employee can act on
 * (expired session, server/network trouble, wrong network).
 */
async function postAction(url: string) {
  let res: Response
  try {
    res = await fetch(url, { method: 'POST' })
  } catch {
    throw new ActionError('No internet connection. Check that WiFi is on and try again.')
  }

  if (res.status === 401) {
    window.location.href = `/login?callbackUrl=${encodeURIComponent('/employee/clock')}`
    throw new ActionError('Your session has expired. Please sign in again.')
  }

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    if (!data) throw new ActionError('The server did not respond properly. Please wait a few seconds and try again.')
    throw new ActionError(data.message || data.error || 'Something went wrong. Please try again.', data.code === 'IP_FAIL' ? data.ip : undefined)
  }
  return data
}

export default function EmployeeClockPage() {
  const queryClient = useQueryClient()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [deniedIp, setDeniedIp] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Difference between the server clock and this phone's clock, so the countdown can't be gamed
  const offsetRef = useRef(0)
  const [now, setNow] = useState(() => Date.now())

  const { data: status, isLoading } = useQuery<ClockStatus>({
    queryKey: ['clockStatus'],
    queryFn: async () => {
      const res = await fetch('/api/clock/status')
      if (res.status === 401) {
        window.location.href = `/login?callbackUrl=${encodeURIComponent('/employee/clock')}`
        throw new Error('Session expired')
      }
      if (!res.ok) throw new Error('Failed to fetch status')
      const data: ClockStatus = await res.json()
      offsetRef.current = new Date(data.serverTime).getTime() - Date.now()
      return data
    },
    // While on lunch, keep checking so an overdue break is penalized and shown promptly
    refetchInterval: query => (query.state.data?.lunch && !query.state.data.lunch.endedAt ? 30000 : false),
  })

  const lunch = status?.lunch ?? null
  const onLunch = !!lunch && !lunch.endedAt

  useEffect(() => {
    if (!onLunch) return
    const timer = setInterval(() => setNow(Date.now() + offsetRef.current), 1000)
    return () => clearInterval(timer)
  }, [onLunch])

  const remainingMs = onLunch ? new Date(lunch!.dueAt).getTime() - now : 0
  const isLunchOverdue = onLunch && remainingMs <= 0

  // Refresh once the timer runs out so the server applies the penalty right away
  useEffect(() => {
    if (isLunchOverdue && !lunch?.isOverdue) {
      queryClient.invalidateQueries({ queryKey: ['clockStatus'] })
    }
  }, [isLunchOverdue, lunch?.isOverdue, queryClient])

  const clockMutation = useMutation({
    mutationFn: async (type: 'in' | 'out') => {
      setErrorMsg(null)
      setDeniedIp(null)
      setSuccessMsg(null)
      const data = await postAction(`/api/clock/${type}`)
      return { type, data }
    },
    onSuccess: ({ type }) => {
      setSuccessMsg(`Successfully clocked ${type}.`)
      queryClient.invalidateQueries({ queryKey: ['clockStatus'] })
    },
    onError: (err: Error) => {
      setErrorMsg(err.message)
      setDeniedIp(err instanceof ActionError ? err.ip ?? null : null)
      queryClient.invalidateQueries({ queryKey: ['clockStatus'] })
    }
  })

  const lunchMutation = useMutation({
    mutationFn: async (action: 'start' | 'end') => {
      setErrorMsg(null)
      setDeniedIp(null)
      setSuccessMsg(null)
      const data = await postAction(`/api/lunch/${action}`)
      return { action, data }
    },
    onSuccess: ({ action, data }) => {
      setSuccessMsg(
        action === 'start'
          ? `Lunch started. Tap Lunch Out within ${status?.lunchMinutes ?? 60} minutes.`
          : data.late ? 'Lunch ended, but you were late. The owner has been notified.' : 'Welcome back! Lunch ended on time.'
      )
      setNow(Date.now() + offsetRef.current)
      queryClient.invalidateQueries({ queryKey: ['clockStatus'] })
    },
    onError: (err: Error) => {
      setErrorMsg(err.message)
      queryClient.invalidateQueries({ queryKey: ['clockStatus'] })
    }
  })

  const handleAction = () => {
    if (status?.isClockedIn) {
      clockMutation.mutate('out')
    } else {
      clockMutation.mutate('in')
    }
  }

  return (
    <div className="max-w-md mx-auto space-y-6 pt-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">Attendance</h1>
        <p className="text-slate-500">Make sure you are connected to the shop Wi-Fi before clocking in.</p>
      </div>

      {errorMsg && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Action Denied</AlertTitle>
          <AlertDescription>
            <p>{errorMsg}</p>
            {deniedIp && (
              <ul className="mt-2 list-disc pl-5 space-y-1 text-xs">
                <li>Make sure WiFi is on and connected to the shop network, then try again.</li>
                <li>Turn off mobile data, any VPN, and on iPhone &quot;iCloud Private Relay&quot; / &quot;Limit IP Address Tracking&quot; for this WiFi.</li>
                <li>Still denied on the shop WiFi? The shop&apos;s internet address may have changed. Your admin has been notified. Show them this code: <span className="font-mono font-semibold break-all">{deniedIp}</span></li>
              </ul>
            )}
          </AlertDescription>
        </Alert>
      )}

      {successMsg && (
        <Alert className="bg-green-50 text-green-800 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>{successMsg}</AlertDescription>
        </Alert>
      )}

      <Card className="border-blue-200 shadow-lg overflow-hidden">
        <div className="h-2 w-full bg-gradient-to-r from-blue-400 to-blue-600" />
        <CardContent className="p-8 text-center space-y-8">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <div className={`inline-flex items-center justify-center p-4 rounded-full mb-4 ${status?.isClockedIn ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                  <Clock className="w-12 h-12" />
                </div>
                <h2 className="text-2xl font-semibold text-slate-900">
                  {status?.isClockedIn ? 'Clocked In' : 'Not Clocked In'}
                </h2>
                {status?.lastLog && (
                  <p className="text-sm text-slate-500">
                    Last {status.lastLog.type === 'IN' ? 'clock in' : 'clock out'} was at {new Date(status.lastLog.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Colombo' })}
                  </p>
                )}
              </div>

              <Button 
                size="lg" 
                className={`w-full h-16 text-lg rounded-xl shadow-lg transition-all ${status?.isClockedIn ? 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/20' : 'bg-blue-500 hover:bg-blue-600 shadow-blue-500/20'}`}
                onClick={handleAction}
                disabled={clockMutation.isPending || onLunch}
              >
                {clockMutation.isPending ? (
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-2"></div>
                ) : status?.isClockedIn ? (
                  <LogOut className="mr-2 h-6 w-6" />
                ) : (
                  <LogIn className="mr-2 h-6 w-6" />
                )}
                {clockMutation.isPending 
                  ? 'Processing...' 
                  : status?.isClockedIn ? 'Clock Out' : 'Clock In'
                }
              </Button>
              {onLunch && (
                <p className="text-xs text-slate-500 -mt-4">End your lunch break before clocking out.</p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {!isLoading && (status?.isClockedIn || lunch) && (
        <Card className={`shadow-lg overflow-hidden ${isLunchOverdue ? 'border-red-300' : 'border-amber-200'}`}>
          <div className={`h-2 w-full bg-gradient-to-r ${isLunchOverdue ? 'from-red-400 to-red-600' : 'from-amber-400 to-orange-500'}`} />
          <CardContent className="p-6 text-center space-y-5">
            <div className="flex items-center justify-center gap-2 text-slate-900">
              <UtensilsCrossed className={`w-5 h-5 ${isLunchOverdue ? 'text-red-500' : 'text-amber-500'}`} />
              <h2 className="text-lg font-semibold">Lunch Break</h2>
            </div>

            {onLunch ? (
              <>
                <div>
                  <p className={`text-5xl font-black font-mono tabular-nums ${isLunchOverdue ? 'text-red-600' : 'text-slate-900'}`} aria-live="polite">
                    {isLunchOverdue ? `-${formatDuration(-remainingMs)}` : formatDuration(remainingMs)}
                  </p>
                  <p className="text-sm text-slate-500 mt-2">
                    Started {colomboTime(lunch!.startedAt)} · due back by <strong>{colomboTime(lunch!.dueAt)}</strong>
                  </p>
                </div>

                {isLunchOverdue && (
                  <Alert variant="destructive" className="text-left">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Lunch time is over</AlertTitle>
                    <AlertDescription>The owner has been notified and penalty points were added. Tap Lunch Out as soon as you are back on the shop WiFi.</AlertDescription>
                  </Alert>
                )}

                <Button
                  size="lg"
                  className="w-full h-14 text-lg rounded-xl bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20"
                  onClick={() => lunchMutation.mutate('end')}
                  isLoading={lunchMutation.isPending}
                >
                  <LogIn className="mr-2 h-5 w-5" /> Lunch Out (back to work)
                </Button>
                <p className="text-xs text-slate-500">You must be connected to the shop WiFi.</p>
              </>
            ) : lunch?.endedAt ? (
              <div className="space-y-2">
                <p className="text-sm text-slate-600">
                  Lunch taken {colomboTime(lunch.startedAt)} – {colomboTime(lunch.endedAt)}
                </p>
                {new Date(lunch.endedAt) > new Date(lunch.dueAt) ? (
                  <p className="text-sm font-semibold text-red-600">Returned late. Penalty points were added.</p>
                ) : (
                  <p className="text-sm font-semibold text-emerald-600">Returned on time.</p>
                )}
              </div>
            ) : (
              <>
                <p className="text-sm text-slate-500">
                  You have <strong>{status?.lunchMinutes ?? 60} minutes</strong> for lunch. Tap Lunch Out when you are back,
                  or penalty points are added and the owner is notified.
                </p>
                <Button
                  size="lg"
                  className="w-full h-14 text-lg rounded-xl bg-amber-500 hover:bg-amber-600 shadow-lg shadow-amber-500/20"
                  onClick={() => lunchMutation.mutate('start')}
                  isLoading={lunchMutation.isPending}
                >
                  <UtensilsCrossed className="mr-2 h-5 w-5" /> Lunch In (start break)
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
