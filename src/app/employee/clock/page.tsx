'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Clock, LogIn, LogOut, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useState } from 'react'

export default function EmployeeClockPage() {
  const queryClient = useQueryClient()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const { data: status, isLoading } = useQuery<{
    isClockedIn: boolean
    lastLog: { type: string, timestamp: string, isValid: boolean, flagReason: string } | null
  }>({
    queryKey: ['clockStatus'],
    queryFn: async () => {
      const res = await fetch('/api/clock/status')
      if (!res.ok) throw new Error('Failed to fetch status')
      return res.json()
    }
  })

  const clockMutation = useMutation({
    mutationFn: async (type: 'in' | 'out') => {
      setErrorMsg(null)
      setSuccessMsg(null)
      
      const res = await fetch(`/api/clock/${type}`, { method: 'POST' })
      const data = await res.json()
      
      if (!res.ok) {
        throw new Error(data.message || data.error || `Failed to clock ${type}`)
      }
      return { type, data }
    },
    onSuccess: ({ type }) => {
      setSuccessMsg(`Successfully clocked ${type}.`)
      queryClient.invalidateQueries({ queryKey: ['clockStatus'] })
    },
    onError: (err: any) => {
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
          <AlertDescription>{errorMsg}</AlertDescription>
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
                disabled={clockMutation.isPending}
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
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
