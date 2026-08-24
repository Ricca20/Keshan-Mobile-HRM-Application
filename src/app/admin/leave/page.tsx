'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Calendar, CheckCircle2, XCircle, Clock, FileText } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { useState } from 'react'
import { useToast } from '@/components/ui/toast'
import { PromptModal } from '@/components/ui/modal'

type LeaveRequest = {
  id: string
  user: { name: string, email: string, shop: { name: string } }
  leaveType: { name: string, isPaid: boolean }
  startDate: string
  endDate: string
  totalDays: number
  reason: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  createdAt: string
  approverNote?: string | null
}

export default function AdminLeaveRequestsPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'PENDING' | 'HISTORY'>('PENDING')
  const toast = useToast()
  
  const [promptState, setPromptState] = useState<{ isOpen: boolean, id: string, status: 'APPROVED' | 'REJECTED' }>({
    isOpen: false,
    id: '',
    status: 'APPROVED'
  })

  const { data: requests = [], isLoading } = useQuery<LeaveRequest[]>({
    queryKey: ['leaveRequests', activeTab],
    queryFn: async () => {
      const url = activeTab === 'PENDING' 
        ? '/api/leave/requests?status=PENDING' 
        : '/api/leave/requests'
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to fetch leave requests')
      
      const data = await res.json()
      // Filter out pending from history tab client-side if needed, 
      // but passing status=PENDING handles the first tab.
      if (activeTab === 'HISTORY') {
        return data.filter((r: LeaveRequest) => r.status !== 'PENDING')
      }
      return data
    }
  })

  const reviewMutation = useMutation({
    mutationFn: async ({ id, status, note }: { id: string, status: string, note?: string }) => {
      const res = await fetch(`/api/leave/requests/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, approverNote: note })
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to review request')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaveRequests'] })
      toast.success('Leave request updated successfully')
    },
    onError: (err: any) => {
      toast.error(err.message)
    }
  })

  const handleReview = (id: string, status: 'APPROVED' | 'REJECTED') => {
    setPromptState({ isOpen: true, id, status })
  }

  const handlePromptSubmit = (note: string) => {
    reviewMutation.mutate({ id: promptState.id, status: promptState.status, note })
    setPromptState(prev => ({ ...prev, isOpen: false }))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Leave Management</h1>
          <p className="text-slate-500 text-sm mt-1">Review and manage employee leave requests.</p>
        </div>
        <Link href="/admin/leave/types" className="w-full sm:w-auto">
          <Button variant="outline" className="w-full">
            Configure Leave Types
          </Button>
        </Link>
      </div>

      <div className="flex gap-2 border-b border-slate-200 px-2">
        <button
          className={`px-6 py-3 font-semibold border-b-2 transition-colors ${activeTab === 'PENDING' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
          onClick={() => setActiveTab('PENDING')}
        >
          Pending Requests
        </button>
        <button
          className={`px-6 py-3 font-semibold border-b-2 transition-colors ${activeTab === 'HISTORY' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
          onClick={() => setActiveTab('HISTORY')}
        >
          History
        </button>
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center p-16 text-slate-400 bg-slate-50/50">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-20 text-slate-500" />
              <h3 className="text-lg font-semibold text-slate-900">No {activeTab.toLowerCase()} requests</h3>
              <p className="text-sm mt-1">You're all caught up!</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {requests.map(request => (
                <div key={request.id} className="p-6 md:p-8 flex flex-col md:flex-row gap-6 hover:bg-slate-50/50 transition-colors bg-white">
                  <div className="flex-1 space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-xl text-slate-900">{request.user.name}</h3>
                        <p className="text-sm font-medium text-slate-500 mt-1">{request.user.shop.name}</p>
                      </div>
                      <Badge variant={
                        request.status === 'APPROVED' ? 'success' : 
                        request.status === 'REJECTED' ? 'danger' : 'warning'
                      } className="uppercase tracking-wider font-bold">
                        {request.status}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap gap-4 text-sm bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-slate-400" />
                        <span className="font-semibold text-slate-700">{request.leaveType.name}</span>
                        <Badge variant="outline" size="sm" className="bg-white">{request.leaveType.isPaid ? 'Paid' : 'Unpaid'}</Badge>
                      </div>
                      <div className="w-px h-4 bg-slate-200 hidden sm:block"></div>
                      <div className="flex items-center gap-2 font-medium text-slate-600">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <span>{new Date(request.startDate).toLocaleDateString()} to {new Date(request.endDate).toLocaleDateString()}</span>
                      </div>
                      <div className="w-px h-4 bg-slate-200 hidden sm:block"></div>
                      <div className="flex items-center gap-2 font-medium text-slate-600">
                        <Clock className="w-4 h-4 text-slate-400" />
                        <span className="font-bold text-slate-900">{request.totalDays} Day(s)</span>
                      </div>
                    </div>

                    <div className="bg-white">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Reason provided</p>
                      <p className="text-sm text-slate-700 font-medium italic border-l-2 border-slate-300 pl-3">"{request.reason}"</p>
                    </div>
                    
                    {request.approverNote && (
                      <div className="mt-3 text-sm bg-blue-50 text-blue-800 p-3 rounded-xl border border-blue-100">
                        <strong className="block mb-1 text-xs uppercase tracking-wider opacity-80">Admin Note:</strong> 
                        {request.approverNote}
                      </div>
                    )}
                  </div>

                  <div className="flex md:flex-col gap-3 items-end justify-center md:min-w-[160px] border-t md:border-t-0 md:border-l border-slate-100 pt-6 md:pt-0 md:pl-8">
                    {request.status === 'PENDING' ? (
                      <>
                        <Button 
                          className="w-full bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20 shadow-lg" 
                          onClick={() => handleReview(request.id, 'APPROVED')}
                          disabled={reviewMutation.isPending}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" /> Approve
                        </Button>
                        <Button 
                          variant="danger" 
                          className="w-full shadow-red-500/20 shadow-lg" 
                          onClick={() => handleReview(request.id, 'REJECTED')}
                          disabled={reviewMutation.isPending}
                        >
                          <XCircle className="w-4 h-4 mr-2" /> Reject
                        </Button>
                      </>
                    ) : (
                      // Allow undoing an approved/rejected request
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="w-full"
                        onClick={() => handleReview(request.id, request.status === 'APPROVED' ? 'REJECTED' : 'APPROVED')}
                        disabled={reviewMutation.isPending}
                      >
                        Change to {request.status === 'APPROVED' ? 'Rejected' : 'Approved'}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <PromptModal 
        isOpen={promptState.isOpen}
        onClose={() => setPromptState(prev => ({ ...prev, isOpen: false }))}
        onSubmit={handlePromptSubmit}
        title={`Note for ${promptState.status === 'APPROVED' ? 'Approval' : 'Rejection'}`}
        description={`Enter an optional note explaining the ${promptState.status.toLowerCase()} (or leave blank):`}
        placeholder="Type note here..."
        submitText={promptState.status === 'APPROVED' ? 'Approve Request' : 'Reject Request'}
      />
    </div>
  )
}
