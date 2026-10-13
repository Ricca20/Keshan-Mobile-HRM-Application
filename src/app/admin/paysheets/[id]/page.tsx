'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle2, Save, AlertTriangle, TrendingDown, TrendingUp, Building, Clock, Receipt } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useState, useEffect } from 'react'
import { useToast } from '@/components/ui/toast'
import { ConfirmModal, PromptModal } from '@/components/ui/modal'
import { PayslipBreakdown } from '@/components/payroll/PayslipBreakdown'
import { automaticDeductions, calculateNetPay, extraDeduction, round2, type PaysheetAmounts } from '@/lib/payslip'

type Paysheet = PaysheetAmounts & {
  id: string
  month: number
  year: number
  status: 'DRAFT' | 'FINALIZED' | 'PAYMENT_CLAIMED' | 'ACKNOWLEDGED' | 'DISPUTED'
  paymentReference: string | null
  paidAt: string | null
  acknowledgedAt: string | null
  disputeReason: string | null
  user: { name: string, shop: { name: string } | null }
}

export default function PaysheetDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  
  const [bonuses, setBonuses] = useState<number>(0)
  // Admin's extra deduction, on top of the automatic ones
  const [extra, setExtra] = useState<number>(0)
  const [bonusNote, setBonusNote] = useState('')
  const [deductionNote, setDeductionNote] = useState('')
  const toast = useToast()
  const [isFinalizeModalOpen, setIsFinalizeModalOpen] = useState(false)
  const [isPaidModalOpen, setIsPaidModalOpen] = useState(false)

  const { data: ps, isLoading } = useQuery<Paysheet>({
    queryKey: ['paysheet', id],
    queryFn: async () => {
      const res = await fetch(`/api/paysheets/${id}`)
      if (!res.ok) throw new Error('Failed to fetch paysheet')
      return res.json()
    }
  })

  useEffect(() => {
    if (ps) {
      setBonuses(ps.bonuses)
      setExtra(extraDeduction(ps))
      setBonusNote(ps.bonusNote || '')
      setDeductionNote(ps.deductionNote || '')
    }
  }, [ps])

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/paysheets/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bonuses,
          deductions: round2(Math.max(0, automaticDeductions(ps!) + extra)),
          bonusNote,
          deductionNote,
        })
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to update')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paysheet', id] })
      toast.success('Paysheet updated')
    },
    onError: (err: Error) => toast.error(err.message)
  })

  const finalizeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/paysheets/finalize/${id}`, {
        method: 'POST'
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to finalize')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paysheet', id] })
      queryClient.invalidateQueries({ queryKey: ['paysheets'] })
      setIsFinalizeModalOpen(false)
      toast.success('Paysheet finalized!')
    },
    onError: (err: Error) => toast.error(err.message)
  })

  const markPaidMutation = useMutation({
    mutationFn: async (ref: string) => {
      const res = await fetch(`/api/paysheets/pay/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentReference: ref })
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to mark as paid')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paysheet', id] })
      queryClient.invalidateQueries({ queryKey: ['paysheets'] })
      setIsPaidModalOpen(false)
      toast.success('Marked as paid! Awaiting employee acknowledgement.')
    },
    onError: (err: Error) => toast.error(err.message)
  })

  const resolveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/paysheets/resolve/${id}`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to resolve dispute')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paysheet', id] })
      queryClient.invalidateQueries({ queryKey: ['paysheets'] })
      toast.success('Dispute resolved. Employee will re-acknowledge.')
    },
    onError: (err: Error) => toast.error(err.message)
  })

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (!ps) return <div className="p-8 text-center text-slate-500">Paysheet not found</div>

  const isDraft = ps.status === 'DRAFT'
  const isFinalized = ps.status === 'FINALIZED'
  // Live preview of the payslip with the adjustments typed so far
  const previewDeductions = round2(Math.max(0, automaticDeductions(ps) + extra))
  const preview: PaysheetAmounts = { ...ps, bonuses, bonusNote, deductionNote, deductions: previewDeductions }
  const netPayPreview = calculateNetPay(ps.baseSalary, ps.otPay, previewDeductions, bonuses)

  const stats = [
    { label: 'Days paid', value: ps.paidDays, tone: 'text-emerald-700' },
    { label: 'Days unpaid', value: ps.unpaidDays, hint: 'absent or unpaid leave', tone: ps.unpaidDays > 0 ? 'text-red-700' : 'text-slate-900' },
    { label: 'Half days', value: ps.halfDaysTotal, tone: ps.halfDaysTotal > 0 ? 'text-orange-700' : 'text-slate-900' },
    { label: 'Late days', value: ps.lateDaysTotal, hint: ps.lateMinutesTotal > 0 ? `${ps.lateMinutesTotal} min in total` : undefined, tone: ps.lateDaysTotal > 0 ? 'text-orange-700' : 'text-slate-900' },
    { label: 'Overtime', value: `${ps.otHoursTotal} h`, tone: ps.otHoursTotal > 0 ? 'text-indigo-700' : 'text-slate-900' },
    { label: 'Penalty points charged', value: ps.penaltyPointsCharged, tone: ps.penaltyPointsCharged > 0 ? 'text-red-700' : 'text-slate-900' },
  ]

  return (
    <div className="space-y-6 max-w-5xl mx-auto pt-4 pb-20">
      <div className="flex items-center gap-4 mb-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full bg-white border border-slate-200 shadow-sm hover:bg-slate-50 text-slate-500" aria-label="Back">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Paysheet Details</h1>
          <p className="text-slate-500 mt-1">{ps.user.name} &bull; {new Date(2000, ps.month - 1).toLocaleString('default', { month: 'long' })} {ps.year}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-4 bg-slate-50/50 border-b border-slate-100">
              <div>
                <CardTitle className="text-lg font-bold text-slate-900">Attendance this month</CardTitle>
                <CardDescription className="flex items-center gap-1.5 mt-1"><Building className="w-3.5 h-3.5" /> {ps.user.shop?.name ?? 'No shop'}</CardDescription>
              </div>
              <Badge variant={isDraft ? 'warning' : 'success'} className="uppercase tracking-wider font-bold">{ps.status.replace('_', ' ')}</Badge>
            </CardHeader>
            <CardContent className="p-6">
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {stats.map(stat => (
                  <div key={stat.label} className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                    <dt className="text-xs text-slate-500">{stat.label}</dt>
                    <dd className={`text-xl font-bold mt-0.5 ${stat.tone}`}>{stat.value}</dd>
                    {stat.hint && <p className="text-[11px] text-slate-400 mt-0.5">{stat.hint}</p>}
                  </div>
                ))}
              </dl>
              <p className="text-xs text-slate-500 mt-4">
                Counted from the daily attendance records up to yesterday. To fix a day, correct it on the Attendance page and regenerate this draft.
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
              <CardTitle className="text-lg font-bold text-slate-900">Adjustments</CardTitle>
              <CardDescription>
                {isDraft
                  ? 'Add a bonus or an extra deduction. The automatic deductions in the payslip stay as they are.'
                  : 'Adjustments can only be changed while the paysheet is a draft.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-3 bg-emerald-50/30 p-4 rounded-2xl border border-emerald-100/50">
                  <label htmlFor="adj-bonus" className="text-sm font-semibold text-emerald-700 flex items-center gap-1.5"><TrendingUp className="w-4 h-4" /> Bonus / allowance (Rs)</label>
                  <input
                    id="adj-bonus"
                    type="number"
                    min={0}
                    disabled={!isDraft}
                    className="w-full p-3 rounded-xl border border-slate-200 bg-white text-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none disabled:opacity-60 disabled:bg-slate-50 font-semibold"
                    value={bonuses}
                    onChange={(e) => setBonuses(Number(e.target.value))}
                  />
                  <input
                    type="text"
                    disabled={!isDraft}
                    aria-label="Bonus reason"
                    placeholder="Reason (e.g. Sales target)"
                    className="w-full p-3 rounded-xl border border-slate-200 bg-white text-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none text-sm disabled:opacity-60 disabled:bg-slate-50"
                    value={bonusNote}
                    onChange={(e) => setBonusNote(e.target.value)}
                  />
                </div>

                <div className="space-y-3 bg-red-50/30 p-4 rounded-2xl border border-red-100/50">
                  <label htmlFor="adj-extra" className="text-sm font-semibold text-red-700 flex items-center gap-1.5"><TrendingDown className="w-4 h-4" /> Extra deduction (Rs)</label>
                  <input
                    id="adj-extra"
                    type="number"
                    min={0}
                    disabled={!isDraft}
                    className="w-full p-3 rounded-xl border border-slate-200 bg-white text-slate-900 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all outline-none disabled:opacity-60 disabled:bg-slate-50 font-semibold"
                    value={extra}
                    onChange={(e) => setExtra(Number(e.target.value))}
                  />
                  <input
                    type="text"
                    disabled={!isDraft}
                    aria-label="Extra deduction reason"
                    placeholder="Reason (e.g. Salary advance)"
                    className="w-full p-3 rounded-xl border border-slate-200 bg-white text-slate-900 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all outline-none text-sm disabled:opacity-60 disabled:bg-slate-50"
                    value={deductionNote}
                    onChange={(e) => setDeductionNote(e.target.value)}
                  />
                </div>
              </div>

              {isDraft && (
                <div className="flex justify-end pt-4 border-t border-slate-100">
                  <Button onClick={() => updateMutation.mutate()} isLoading={updateMutation.isPending} className="shadow-lg shadow-blue-500/20 px-6">
                    <Save className="w-4 h-4 mr-2" /> Save Adjustments
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-blue-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-bold text-blue-900 flex items-center gap-2"><Receipt className="w-5 h-5" /> Payslip</CardTitle>
              <CardDescription>How the net pay is worked out.</CardDescription>
            </CardHeader>
            <CardContent>
              <PayslipBreakdown paysheet={preview} netPay={netPayPreview} />
            </CardContent>
          </Card>

          {isDraft && (
            <div className="bg-white p-5 rounded-2xl border border-orange-200 shadow-sm">
              <div className="flex items-center gap-2 font-bold text-orange-700 mb-2">
                <AlertTriangle className="w-5 h-5 text-orange-500" />
                Draft Status
              </div>
              <p className="text-sm text-slate-600 mb-5 leading-relaxed">
                This paysheet is in draft. Once finalized, it will be visible to the employee and locked from further edits.
              </p>
              <Button 
                className="w-full bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 text-white font-bold h-12" 
                onClick={() => setIsFinalizeModalOpen(true)}
                disabled={finalizeMutation.isPending || updateMutation.isPending}
              >
                <CheckCircle2 className="w-5 h-5 mr-2" /> Finalize Paysheet
              </Button>
            </div>
          )}

          {isFinalized && (
            <div className="bg-white p-5 rounded-2xl border border-blue-200 shadow-sm">
              <div className="flex items-center gap-2 font-bold text-blue-900 mb-2">
                <CheckCircle2 className="w-5 h-5 text-blue-600" />
                Awaiting Payment
              </div>
              <p className="text-sm text-slate-600 mb-5 leading-relaxed">
                This paysheet is finalized. Once you transfer the money, mark it as paid to request acknowledgement from the employee.
              </p>
              <Button 
                className="w-full bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20 text-white font-bold h-12" 
                onClick={() => setIsPaidModalOpen(true)}
              >
                Mark as Paid
              </Button>
            </div>
          )}

          {ps.status === 'PAYMENT_CLAIMED' && (
            <div className="bg-orange-50 p-5 rounded-2xl border border-orange-200 shadow-sm">
              <div className="flex items-center gap-2 font-bold text-orange-900 mb-2">
                <Clock className="w-5 h-5 text-orange-600" />
                Awaiting Acknowledgement
              </div>
              <p className="text-sm text-orange-700 mb-2">
                You marked this as paid on <strong>{new Date(ps.paidAt!).toLocaleDateString()}</strong>.
              </p>
              {ps.paymentReference && (
                <p className="text-sm font-mono bg-white px-2 py-1 rounded border border-orange-200 text-orange-800">
                  Ref: {ps.paymentReference}
                </p>
              )}
            </div>
          )}

          {ps.status === 'ACKNOWLEDGED' && (
            <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-200 shadow-sm">
              <div className="flex items-center gap-2 font-bold text-emerald-900 mb-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                Payment Verified
              </div>
              <p className="text-sm text-emerald-700">
                The employee verified receiving this payment on <strong>{new Date(ps.acknowledgedAt!).toLocaleString()}</strong>.
              </p>
            </div>
          )}

          {ps.status === 'DISPUTED' && (
            <div className="bg-red-50 p-5 rounded-2xl border border-red-200 shadow-sm">
              <div className="flex items-center gap-2 font-bold text-red-900 mb-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                Payment Disputed
              </div>
              <p className="text-sm text-red-700 mb-2">
                The employee disputed this payment.
              </p>
              <div className="bg-white p-3 rounded-lg border border-red-200 text-sm text-slate-700 mb-4">
                <strong>Reason:</strong> {ps.disputeReason}
              </div>
              <Button
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold h-11"
                onClick={() => resolveMutation.mutate()}
                isLoading={resolveMutation.isPending}
              >
                Resolve & Re-Issue Payment
              </Button>
            </div>
          )}
        </div>
      </div>

      <ConfirmModal 
        isOpen={isFinalizeModalOpen}
        onClose={() => setIsFinalizeModalOpen(false)}
        onConfirm={() => finalizeMutation.mutate()}
        title="Finalize Paysheet"
        description="Are you sure you want to finalize this paysheet? This action cannot be undone and will lock the paysheet from further edits."
        confirmText="Finalize"
        variant="primary"
        isLoading={finalizeMutation.isPending}
      />

      <PromptModal 
        isOpen={isPaidModalOpen}
        onClose={() => setIsPaidModalOpen(false)}
        onSubmit={(value) => {
          markPaidMutation.mutate(value)
        }}
        title="Mark as Paid"
        description="Enter a payment reference (e.g. Bank Transfer ID, 'Cash') to prove payment was sent."
        placeholder="e.g. TRF-102934 or 'Cash Handed'"
        submitText="Confirm Payment"
        isLoading={markPaidMutation.isPending}
      />
    </div>
  )
}
