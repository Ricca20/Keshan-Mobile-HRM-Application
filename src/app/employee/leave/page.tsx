'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Calendar, Send, AlertCircle, Plus } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

type LeaveBalance = {
  id: string
  year: number
  totalDays: number
  usedDays: number
  leaveType: { id: string, name: string, isPaid: boolean }
}

type LeaveRequest = {
  id: string
  leaveType: { name: string, isPaid: boolean }
  startDate: string
  endDate: string
  totalDays: number
  reason: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  createdAt: string
  approverNote?: string | null
}

export default function EmployeeLeavePage() {
  const queryClient = useQueryClient()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    leaveTypeId: '',
    startDate: '',
    endDate: '',
    reason: ''
  })

  const { data: balances = [], isLoading: loadingBalances } = useQuery<LeaveBalance[]>({
    queryKey: ['leaveBalances'],
    queryFn: async () => {
      const res = await fetch('/api/leave/balances')
      if (!res.ok) throw new Error('Failed to fetch balances')
      return res.json()
    }
  })

  const { data: requests = [], isLoading: loadingRequests } = useQuery<LeaveRequest[]>({
    queryKey: ['leaveRequestsEmployee'],
    queryFn: async () => {
      const res = await fetch('/api/leave/requests')
      if (!res.ok) throw new Error('Failed to fetch requests')
      return res.json()
    }
  })

  const requestMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      setErrorMsg(null)
      const res = await fetch('/api/leave/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to submit request')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaveRequestsEmployee'] })
      setIsModalOpen(false)
      setFormData({ leaveTypeId: '', startDate: '', endDate: '', reason: '' })
    },
    onError: (err: any) => {
      setErrorMsg(err.message)
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    requestMutation.mutate(formData)
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto pt-4 pb-24">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">My Leave</h1>
          <p className="text-slate-500 mt-1">Manage your time off and view balances.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="w-full sm:w-auto shadow-lg shadow-blue-500/20">
          <Plus className="w-4 h-4 mr-2" /> Request Leave
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {loadingBalances ? (
          [1,2,3,4].map(i => <Card key={i} className="h-32 animate-pulse bg-slate-100/50 border-none" />)
        ) : balances.length === 0 ? (
          <div className="col-span-full p-6 bg-blue-50/50 text-blue-800 rounded-2xl border border-blue-100 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 text-blue-500" />
            <p>Your leave balances have not been generated yet. Please contact your manager.</p>
          </div>
        ) : (
          balances.map(balance => {
            const remaining = balance.totalDays - balance.usedDays
            const percentage = Math.min(100, Math.max(0, (balance.usedDays / balance.totalDays) * 100))
            
            // Determine color based on usage
            const isLow = percentage > 80
            const colorClass = isLow ? 'bg-orange-500' : 'bg-blue-500'
            const bgClass = isLow ? 'bg-orange-100' : 'bg-blue-100'
            
            return (
              <Card key={balance.id} className="relative overflow-hidden border-slate-200 shadow-sm hover:shadow-md transition-shadow group">
                <CardContent className="p-5">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-semibold text-slate-900">{balance.leaveType.name}</h3>
                      <div className="mt-1">
                        <Badge variant={balance.leaveType.isPaid ? 'success' : 'secondary'} size="sm" className="font-medium text-[10px] uppercase tracking-wider">
                          {balance.leaveType.isPaid ? 'Paid' : 'Unpaid'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-black text-slate-900 tracking-tight">{remaining}</span>
                    <span className="text-sm font-medium text-slate-500">days left</span>
                  </div>
                  
                  <div className="mt-5 space-y-2">
                    <div className="flex justify-between text-xs font-medium text-slate-500">
                      <span>Used {balance.usedDays}</span>
                      <span>Total {balance.totalDays}</span>
                    </div>
                    <div className={`h-2 w-full ${bgClass} rounded-full overflow-hidden`}>
                      <div 
                        className={`h-full ${colorClass} rounded-full transition-all duration-1000 ease-out`} 
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="p-6 md:p-8 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-900">Leave History</h2>
          <p className="text-slate-500 text-sm mt-1">Your past and pending leave requests</p>
        </div>
        
        <div className="p-0">
          {loadingRequests ? (
             <div className="flex justify-center p-12">
               <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
             </div>
          ) : requests.length === 0 ? (
            <div className="text-center p-16 text-slate-400 bg-slate-50/50">
              <Calendar className="w-12 h-12 mx-auto mb-3 opacity-20 text-slate-500" />
              <p className="font-medium text-slate-500">No leave requests yet</p>
              <p className="text-sm mt-1">When you request time off, it will appear here.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {requests.map(req => {
                const statusConfig = {
                  APPROVED: { color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500' },
                  REJECTED: { color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', dot: 'bg-red-500' },
                  PENDING: { color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-500' }
                }
                const conf = statusConfig[req.status]
                
                return (
                  <div key={req.id} className="p-6 md:p-8 flex flex-col md:flex-row gap-6 hover:bg-slate-50/50 transition-colors">
                    <div className="md:w-48 shrink-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${conf.dot}`} />
                        <span className={`text-xs font-bold uppercase tracking-wider ${conf.color}`}>{req.status}</span>
                      </div>
                      <div className="text-xs text-slate-400 font-medium">
                        Requested {new Date(req.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-2">
                        <h4 className="text-lg font-bold text-slate-900">{req.leaveType.name}</h4>
                        <Badge variant="outline" className="font-medium">{req.totalDays} day{req.totalDays > 1 ? 's' : ''}</Badge>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-medium text-slate-600">
                        <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4 text-slate-400"/> {new Date(req.startDate).toLocaleDateString()} &rarr; {new Date(req.endDate).toLocaleDateString()}</span>
                      </div>
                      
                      <div className="bg-slate-50 rounded-xl p-4 mt-2">
                        <p className="text-sm text-slate-700 italic border-l-2 border-slate-300 pl-3">"{req.reason}"</p>
                      </div>
                      
                      {req.approverNote && (
                        <div className={`mt-3 text-sm p-3 rounded-xl border ${conf.bg} ${conf.border} ${conf.color}`}>
                          <strong className="block mb-1 text-xs uppercase tracking-wider opacity-80">Note from Admin:</strong> 
                          {req.approverNote}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Request Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-slide-in-left">
            <form onSubmit={handleSubmit}>
              <div className="p-6 md:p-8 border-b border-slate-100">
                <h2 className="text-2xl font-bold text-slate-900">Request Time Off</h2>
                <p className="text-slate-500 mt-1">Submit a new leave request to your manager.</p>
              </div>
              
              <div className="p-6 md:p-8 space-y-5 bg-slate-50/50">
                {errorMsg && (
                  <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-800">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{errorMsg}</AlertDescription>
                  </Alert>
                )}
                
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Leave Type</label>
                  <select
                    required
                    className="w-full p-3 rounded-xl border border-slate-200 bg-white text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none appearance-none"
                    value={formData.leaveTypeId}
                    onChange={e => setFormData({ ...formData, leaveTypeId: e.target.value })}
                  >
                    <option value="" disabled>Select a leave type</option>
                    {balances.map(b => (
                      <option key={b.leaveType.id} value={b.leaveType.id}>
                        {b.leaveType.name} ({b.totalDays - b.usedDays} days left)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Start Date</label>
                    <input
                      type="date"
                      required
                      min={new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' })}
                      className="w-full p-3 rounded-xl border border-slate-200 bg-white text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                      value={formData.startDate}
                      onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">End Date</label>
                    <input
                      type="date"
                      required
                      min={formData.startDate || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' })}
                      className="w-full p-3 rounded-xl border border-slate-200 bg-white text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                      value={formData.endDate}
                      onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Reason</label>
                  <textarea
                    required
                    rows={3}
                    className="w-full p-3 rounded-xl border border-slate-200 bg-white text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none resize-none"
                    placeholder="Brief description of why you are requesting this leave..."
                    value={formData.reason}
                    onChange={e => setFormData({ ...formData, reason: e.target.value })}
                  />
                </div>
              </div>
              
              <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-white">
                <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={requestMutation.isPending} className="px-8 shadow-lg shadow-blue-500/20">
                  <Send className="w-4 h-4 mr-2" /> Submit Request
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
