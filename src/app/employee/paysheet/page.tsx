'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FileText, CalendarDays, Wallet, TrendingDown, TrendingUp, Download, CheckCircle2, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useState } from 'react'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { ConfirmModal, PromptModal } from '@/components/ui/modal'

type PaySheet = {
  id: string
  month: number
  year: number
  baseSalary: number
  paidDays: number
  unpaidDays: number
  deductions: number
  bonuses: number
  netPay: number
  bonusNote: string | null
  deductionNote: string | null
  status: 'DRAFT' | 'FINALIZED' | 'PAYMENT_CLAIMED' | 'ACKNOWLEDGED' | 'DISPUTED'
  finalizedAt: string
  paidAt?: string
  acknowledgedAt?: string
  paymentReference?: string
  disputeReason?: string
}

export default function EmployeePaysheetsPage() {
  const [selectedPaysheet, setSelectedPaysheet] = useState<PaySheet | null>(null)
  const queryClient = useQueryClient()
  const toast = useToast()
  
  const [isAcknowledgeOpen, setIsAcknowledgeOpen] = useState(false)
  const [isDisputeOpen, setIsDisputeOpen] = useState(false)
  const [disputeReason, setDisputeReason] = useState('')

  const acknowledgeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/paysheets/acknowledge/${id}`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to acknowledge')
      return res.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['myPaysheets'] })
      setSelectedPaysheet(data)
      setIsAcknowledgeOpen(false)
      toast.success('Payment acknowledged successfully')
    },
    onError: () => toast.error('Error acknowledging payment')
  })

  const disputeMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await fetch(`/api/paysheets/dispute/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      })
      if (!res.ok) throw new Error('Failed to dispute')
      return res.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['myPaysheets'] })
      setSelectedPaysheet(data)
      setIsDisputeOpen(false)
      toast.success('Payment disputed')
    },
    onError: () => toast.error('Error disputing payment')
  })

  const { data: paysheets = [], isLoading } = useQuery<PaySheet[]>({
    queryKey: ['myPaysheets'],
    queryFn: async () => {
      const res = await fetch('/api/paysheets')
      if (!res.ok) throw new Error('Failed to fetch paysheets')
      return res.json()
    }
  })

  return (
    <div className="space-y-6 max-w-5xl mx-auto pt-4 pb-20">
      <div className="text-center sm:text-left mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">My Paysheets</h1>
        <p className="text-slate-500 mt-1">View your salary history and payroll records.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Sidebar List */}
        <div className="md:col-span-1 space-y-4">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : paysheets.length === 0 ? (
            <div className="text-center p-10 border border-slate-200 border-dashed rounded-2xl bg-slate-50/50 text-slate-400">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">No finalized paysheets available yet.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {paysheets.map(ps => {
                const isSelected = selectedPaysheet?.id === ps.id
                return (
                  <Card 
                    key={ps.id} 
                    className={`cursor-pointer transition-all duration-300 border-2 shadow-none hover:shadow-md hover:-translate-y-0.5 ${isSelected ? 'border-blue-500 bg-blue-50/30' : 'border-slate-100 bg-white hover:border-blue-200'}`}
                    onClick={() => setSelectedPaysheet(ps)}
                  >
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className={`p-3 rounded-xl transition-colors ${isSelected ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20' : 'bg-slate-100 text-slate-500'}`}>
                        <CalendarDays className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className={`font-bold ${isSelected ? 'text-blue-700' : 'text-slate-700'}`}>
                          {new Date(2000, ps.month - 1).toLocaleString('default', { month: 'long' })} {ps.year}
                        </h3>
                        <p className="text-sm font-medium text-slate-500">{formatCurrency(ps.netPay)}</p>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>

        {/* Detail View */}
        <div className="md:col-span-2">
          {selectedPaysheet ? (
            <div className="animate-fade-in sticky top-6">
              <div className="bg-white border-x border-t border-slate-200 rounded-t-2xl p-6 md:p-8 relative overflow-hidden">
                {/* Decorative background element */}
                <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                  <Wallet className="w-48 h-48 text-blue-900" />
                </div>
                
                <div className="relative z-10 flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl md:text-3xl font-bold text-slate-900">
                      {new Date(2000, selectedPaysheet.month - 1).toLocaleString('default', { month: 'long' })} {selectedPaysheet.year}
                    </h2>
                    <p className="text-slate-500 mt-1 flex items-center gap-1.5 text-sm">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      Finalized on {new Date(selectedPaysheet.finalizedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-8">
                  <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-2xl">
                    <p className="text-sm text-blue-600/70 font-medium mb-1">Total Paid Days</p>
                    <p className="text-3xl font-bold text-blue-900">{selectedPaysheet.paidDays}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl">
                    <p className="text-sm text-slate-500 font-medium mb-1">Total Unpaid Days</p>
                    <p className="text-3xl font-bold text-slate-700">{selectedPaysheet.unpaidDays}</p>
                  </div>
                </div>
              </div>

              {/* Receipt Body */}
              <div className="bg-white border-x border-b border-slate-200 rounded-b-2xl p-6 md:p-8 relative shadow-sm">
                {/* Sawtooth top border for receipt effect */}
                <div className="absolute top-0 left-0 right-0 h-4 w-full -mt-2 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCI+PHBvbHlnb24gZmlsbD0id2hpdGUiIHBvaW50cz0iMCwxMCA1LDAgMTAsMTAiLz48L3N2Zz4=')] bg-repeat-x z-20"></div>
                
                <h4 className="font-semibold text-sm tracking-wider text-slate-400 uppercase mb-6">Salary Breakdown</h4>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2">
                    <span className="text-slate-600 font-medium">Base Salary</span>
                    <span className="font-semibold text-slate-900">{formatCurrency(selectedPaysheet.baseSalary)}</span>
                  </div>
                  
                  <div className="flex justify-between items-start py-2 group">
                    <div className="flex gap-3">
                      <div className="mt-0.5 bg-red-50 p-1.5 rounded-lg text-red-500">
                        <TrendingDown className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-slate-600 font-medium group-hover:text-red-600 transition-colors">Deductions</span>
                        <span className="text-xs text-slate-400 mt-0.5">Absences / Unpaid Leave</span>
                        {selectedPaysheet.deductionNote && <span className="text-xs text-red-500/80 mt-1 bg-red-50 p-1.5 rounded-md inline-block max-w-[200px]">{selectedPaysheet.deductionNote}</span>}
                      </div>
                    </div>
                    <span className="font-semibold text-red-600">- {formatCurrency(selectedPaysheet.deductions)}</span>
                  </div>
                  
                  <div className="flex justify-between items-start py-2 group">
                    <div className="flex gap-3">
                      <div className="mt-0.5 bg-emerald-50 p-1.5 rounded-lg text-emerald-500">
                        <TrendingUp className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-slate-600 font-medium group-hover:text-emerald-600 transition-colors">Bonuses & Allowances</span>
                        {selectedPaysheet.bonusNote && <span className="text-xs text-emerald-600/80 mt-1 bg-emerald-50 p-1.5 rounded-md inline-block max-w-[200px]">{selectedPaysheet.bonusNote}</span>}
                      </div>
                    </div>
                    <span className="font-semibold text-emerald-600">+ {formatCurrency(selectedPaysheet.bonuses)}</span>
                  </div>

                  <div className="my-6 border-t-2 border-dashed border-slate-200"></div>

                  <div className="flex justify-between items-center bg-blue-50 p-6 rounded-2xl">
                    <span className="font-bold text-lg text-blue-900">Net Pay</span>
                    <span className="font-black text-3xl text-blue-600">{formatCurrency(selectedPaysheet.netPay)}</span>
                  </div>
                </div>

                {selectedPaysheet.status === 'PAYMENT_CLAIMED' && (
                  <div className="mt-8 bg-orange-50 border border-orange-200 p-5 rounded-2xl shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                      <AlertTriangle className="w-24 h-24 text-orange-900" />
                    </div>
                    <div className="relative z-10">
                      <h4 className="font-bold text-orange-900 flex items-center gap-2 mb-2 text-lg">
                        <AlertTriangle className="w-5 h-5 text-orange-600" /> Payment Issued
                      </h4>
                      <p className="text-sm text-orange-800 mb-5 leading-relaxed">
                        The admin marked this paysheet as paid on <strong>{new Date(selectedPaysheet.paidAt!).toLocaleDateString()}</strong>. 
                        {selectedPaysheet.paymentReference && ` Reference: ${selectedPaysheet.paymentReference}`}
                      </p>
                      <div className="flex sm:flex-row flex-col gap-3">
                        <Button 
                          onClick={() => setIsAcknowledgeOpen(true)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex-1"
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" /> I Received This Payment
                        </Button>
                        <Button 
                          onClick={() => setIsDisputeOpen(true)}
                          variant="outline"
                          className="border-red-200 text-red-600 hover:bg-red-50 flex-1"
                        >
                          I Did Not Receive It
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {selectedPaysheet.status === 'ACKNOWLEDGED' && (
                  <div className="mt-8 bg-emerald-50 border border-emerald-200 p-5 rounded-2xl text-center">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                    <p className="font-bold text-emerald-900">Payment Verified</p>
                    <p className="text-sm text-emerald-700 mt-1">You acknowledged receiving this payment on {new Date(selectedPaysheet.acknowledgedAt!).toLocaleDateString()}.</p>
                  </div>
                )}

                {selectedPaysheet.status === 'DISPUTED' && (
                  <div className="mt-8 bg-red-50 border border-red-200 p-5 rounded-2xl text-center">
                    <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                    <p className="font-bold text-red-900">Payment Disputed</p>
                    <p className="text-sm text-red-700 mt-1">Admin will contact you to resolve this issue.</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="hidden md:flex flex-col h-full min-h-[450px] border border-slate-200 border-dashed rounded-3xl items-center justify-center text-slate-400 bg-slate-50/50">
              <FileText className="w-16 h-16 mb-4 opacity-20 text-slate-500" />
              <p className="font-medium text-slate-500">Select a paysheet from the list</p>
              <p className="text-sm mt-1">To view your detailed salary breakdown</p>
            </div>
          )}
        </div>
      </div>
      
      {selectedPaysheet && (
        <>
          <ConfirmModal
            isOpen={isAcknowledgeOpen}
            onClose={() => setIsAcknowledgeOpen(false)}
            onConfirm={() => acknowledgeMutation.mutate(selectedPaysheet.id)}
            title="Acknowledge Payment"
            description="By clicking confirm, you legally acknowledge that you have received this payment in full. This action cannot be undone."
            confirmText="Acknowledge Receipt"
            variant="primary"
            isLoading={acknowledgeMutation.isPending}
          />

          <PromptModal
            isOpen={isDisputeOpen}
            onClose={() => setIsDisputeOpen(false)}
            onSubmit={(value) => {
              setDisputeReason(value)
              disputeMutation.mutate({ id: selectedPaysheet.id, reason: value })
            }}
            title="Dispute Payment"
            description="If you have not received this payment, provide a reason and we will flag this for the admin."
            placeholder="e.g. Only received Rs. 5000"
            submitText="Submit Dispute"
            isLoading={disputeMutation.isPending}
          />
        </>
      )}
    </div>
  )
}
