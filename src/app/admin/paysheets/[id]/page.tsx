'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle2, Save, AlertTriangle, TrendingDown, TrendingUp, Building, CalendarDays, Calculator, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useState, useEffect } from 'react'
import { useToast } from '@/components/ui/toast'
import { ConfirmModal } from '@/components/ui/modal'

export default function PaysheetDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  
  const [bonuses, setBonuses] = useState<number>(0)
  const [deductions, setDeductions] = useState<number>(0)
  const [bonusNote, setBonusNote] = useState('')
  const [deductionNote, setDeductionNote] = useState('')
  const toast = useToast()
  const [isFinalizeModalOpen, setIsFinalizeModalOpen] = useState(false)

  const { data: ps, isLoading } = useQuery<any>({
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
      setDeductions(ps.deductions)
      setBonusNote(ps.bonusNote || '')
      setDeductionNote(ps.deductionNote || '')
    }
  }, [ps])

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/paysheets/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bonuses, deductions, bonusNote, deductionNote })
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
    onError: (err: any) => toast.error(err.message)
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
    onError: (err: any) => toast.error(err.message)
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
  // Preview net pay calculation
  const netPayPreview = ps.baseSalary - deductions + bonuses

  return (
    <div className="space-y-6 max-w-5xl mx-auto pt-4 pb-20">
      <div className="flex items-center gap-4 mb-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full bg-white border border-slate-200 shadow-sm hover:bg-slate-50 text-slate-500">
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
              <CardTitle className="text-lg font-bold text-slate-900">Overview</CardTitle>
              <Badge variant={isDraft ? 'warning' : 'success'} className="uppercase tracking-wider font-bold">{ps.status}</Badge>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <p className="text-sm text-slate-500 font-medium mb-1 flex items-center gap-1.5"><Building className="w-4 h-4" /> Shop</p>
                  <p className="font-bold text-slate-900">{ps.user.shop.name}</p>
                </div>
                <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                  <p className="text-sm text-emerald-600/80 font-medium mb-1 flex items-center gap-1.5"><CalendarDays className="w-4 h-4" /> Paid Days</p>
                  <p className="font-bold text-emerald-900">{ps.paidDays}</p>
                </div>
                <div className="bg-orange-50 rounded-xl p-4 border border-orange-100 sm:col-span-1 col-span-2">
                  <p className="text-sm text-orange-600/80 font-medium mb-1 flex items-center gap-1.5"><CalendarDays className="w-4 h-4" /> Unpaid Days</p>
                  <p className="font-bold text-orange-900">{ps.unpaidDays}</p>
                </div>
                <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100 sm:col-span-3">
                  <p className="text-sm text-indigo-600/80 font-medium mb-2 flex items-center gap-1.5"><Clock className="w-4 h-4" /> HRMS Breakdown</p>
                  <div className="grid grid-cols-3 gap-4">
                     <div>
                        <p className="text-xs text-indigo-500 uppercase tracking-wider font-bold">OT Hours</p>
                        <p className="font-bold text-indigo-900">{ps.otHoursTotal}h <span className="text-indigo-600 text-sm font-medium">(Rs. {ps.otPay})</span></p>
                     </div>
                     <div>
                        <p className="text-xs text-indigo-500 uppercase tracking-wider font-bold">Late Minutes</p>
                        <p className="font-bold text-indigo-900">{ps.lateMinutesTotal}m <span className="text-indigo-600 text-sm font-medium">(-Rs. {ps.lateDeduction})</span></p>
                     </div>
                     <div>
                        <p className="text-xs text-indigo-500 uppercase tracking-wider font-bold">Half Days</p>
                        <p className="font-bold text-indigo-900">{ps.halfDaysTotal} <span className="text-indigo-600 text-sm font-medium">(-Rs. {ps.halfDayDeduction})</span></p>
                     </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
              <CardTitle className="text-lg font-bold text-slate-900">Adjustments</CardTitle>
              <CardDescription>Manually override bonuses or deductions.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-3 bg-emerald-50/30 p-4 rounded-2xl border border-emerald-100/50">
                  <label className="text-sm font-semibold text-emerald-700 flex items-center gap-1.5"><TrendingUp className="w-4 h-4" /> Bonuses (Rs)</label>
                  <input
                    type="number"
                    disabled={!isDraft}
                    className="w-full p-3 rounded-xl border border-slate-200 bg-white text-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none disabled:opacity-60 disabled:bg-slate-50 font-semibold"
                    value={bonuses}
                    onChange={(e) => setBonuses(Number(e.target.value))}
                  />
                  <input
                    type="text"
                    disabled={!isDraft}
                    placeholder="Bonus note (e.g. Performance)"
                    className="w-full p-3 rounded-xl border border-slate-200 bg-white text-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none text-sm disabled:opacity-60 disabled:bg-slate-50"
                    value={bonusNote}
                    onChange={(e) => setBonusNote(e.target.value)}
                  />
                </div>
                
                <div className="space-y-3 bg-red-50/30 p-4 rounded-2xl border border-red-100/50">
                  <label className="text-sm font-semibold text-red-700 flex items-center gap-1.5"><TrendingDown className="w-4 h-4" /> Deductions (Rs)</label>
                  <input
                    type="number"
                    disabled={!isDraft}
                    className="w-full p-3 rounded-xl border border-slate-200 bg-white text-slate-900 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all outline-none disabled:opacity-60 disabled:bg-slate-50 font-semibold"
                    value={deductions}
                    onChange={(e) => setDeductions(Number(e.target.value))}
                  />
                  <input
                    type="text"
                    disabled={!isDraft}
                    placeholder="Deduction note (e.g. Absences)"
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
          <Card className="border-blue-200 shadow-sm bg-blue-50/30 overflow-hidden relative">
            <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
              <Calculator className="w-32 h-32 text-blue-900" />
            </div>
            <CardHeader className="pb-2 relative z-10">
              <CardTitle className="text-lg font-bold text-blue-900">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 relative z-10">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600 font-medium">Base Salary</span>
                <span className="font-semibold text-slate-900">Rs. {ps.baseSalary.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-emerald-600 font-medium flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5" /> Bonuses</span>
                <span className="font-semibold text-emerald-600">+ Rs. {bonuses.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-red-600 font-medium flex items-center gap-1.5"><TrendingDown className="w-3.5 h-3.5" /> Deductions</span>
                <span className="font-semibold text-red-600">- Rs. {deductions.toLocaleString()}</span>
              </div>
              <div className="pt-4 border-t-2 border-dashed border-blue-200/60 flex justify-between items-center bg-white p-4 rounded-xl shadow-sm mt-4">
                <span className="font-bold text-slate-900">Net Pay</span>
                <span className="font-black text-2xl text-blue-600">Rs. {netPayPreview.toLocaleString()}</span>
              </div>
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
    </div>
  )
}
