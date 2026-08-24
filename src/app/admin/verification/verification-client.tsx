'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ShieldAlert, CheckCircle, Clock, XCircle, Users, Activity } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

type User = {
  id: string
  name: string
  email: string
  penaltyPoints: number
}

type Verification = {
  id: string
  userId: string
  status: 'PENDING' | 'VERIFIED' | 'MISSED' | 'PENALIZED'
  sentAt: Date
  expiresAt: Date
  verifiedAt: Date | null
  user: {
    name: string
    penaltyPoints: number
  }
}

export function VerificationClient({ 
  onlineUsers, 
  recentVerifications 
}: { 
  onlineUsers: User[]
  recentVerifications: Verification[] 
}) {
  const router = useRouter()
  const [pinging, setPinging] = useState<string | null>(null)
  const [penalizing, setPenalizing] = useState<string | null>(null)

  const handleManualPing = async (userId: string) => {
    setPinging(userId)
    try {
      await fetch('/api/verification/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      })
      router.refresh()
    } catch (e) {
      console.error(e)
    } finally {
      setPinging(null)
    }
  }

  const handlePenalize = async (id: string) => {
    setPenalizing(id)
    try {
      await fetch(`/api/verification/penalize/${id}`, { method: 'POST' })
      router.refresh()
    } catch (e) {
      console.error(e)
    } finally {
      setPenalizing(null)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Online Users Panel */}
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-500" />
              Clocked-in Employees
            </h2>
            <Badge variant="secondary">{onlineUsers.length} Online</Badge>
          </div>
          <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
            {onlineUsers.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">No employees currently clocked in.</div>
            ) : (
              onlineUsers.map(user => (
                <div key={user.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div>
                    <p className="font-bold text-sm text-slate-900">{user.name}</p>
                    <p className="text-xs text-slate-500">{user.penaltyPoints} Penalty Points</p>
                  </div>
                  <button
                    onClick={() => handleManualPing(user.id)}
                    disabled={pinging === user.id}
                    className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Activity className="w-3.5 h-3.5" />
                    {pinging === user.id ? 'Sending...' : 'Ping'}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* History Panel */}
      <div className="lg:col-span-2">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-full">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <h2 className="font-bold text-slate-900 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-slate-500" />
              Verification History
            </h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-bold bg-white whitespace-nowrap">
                  <th className="p-4">Employee</th>
                  <th className="p-4">Sent At</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {recentVerifications.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-500">No verifications sent yet.</td>
                  </tr>
                ) : (
                  recentVerifications.map(v => (
                    <tr key={v.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 font-semibold text-slate-900">
                        {v.user.name}
                        <span className="block text-xs font-normal text-slate-500">{v.user.penaltyPoints} Total Points</span>
                      </td>
                      <td className="p-4 text-slate-600">
                        {format(new Date(v.sentAt), 'MMM d, h:mm a')}
                      </td>
                      <td className="p-4">
                        {v.status === 'PENDING' && <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>}
                        {v.status === 'VERIFIED' && <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200"><CheckCircle className="w-3 h-3 mr-1" /> Verified</Badge>}
                        {v.status === 'MISSED' && <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200"><XCircle className="w-3 h-3 mr-1" /> Missed</Badge>}
                        {v.status === 'PENALIZED' && <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200"><ShieldAlert className="w-3 h-3 mr-1" /> Penalized</Badge>}
                      </td>
                      <td className="p-4 text-right">
                        {v.status === 'MISSED' && (
                          <button
                            onClick={() => handlePenalize(v.id)}
                            disabled={penalizing === v.id}
                            className="px-3 py-1.5 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg text-xs font-bold transition disabled:opacity-50 inline-flex items-center gap-1"
                          >
                            Add Penalty Point
                          </button>
                        )}
                        {v.status === 'PENALIZED' && (
                          <span className="text-xs font-bold text-slate-400">Point Added</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
