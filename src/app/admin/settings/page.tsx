'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Settings, Save, AlertCircle, Info } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'

export default function AdminSettingsPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  
  const [penaltyThreshold, setPenaltyThreshold] = useState('10')
  const [penaltyAmount, setPenaltyAmount] = useState('1000')

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
    }
  }, [settings])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          PENALTY_THRESHOLD: penaltyThreshold,
          PENALTY_AMOUNT: penaltyAmount 
        })
      })
      if (!res.ok) throw new Error('Failed to save settings')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      toast.success('Settings saved successfully')
    },
    onError: (err: any) => toast.error(err.message)
  })

  // Preview calculation
  const threshold = Number(penaltyThreshold) || 10
  const amount = Number(penaltyAmount) || 1000

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <Settings className="w-6 h-6 text-blue-500" /> System Settings
        </h1>
        <p className="text-slate-500 text-sm mt-1">Configure global application parameters.</p>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100">
          <CardTitle className="text-lg font-bold text-slate-900">Penalty & Payroll Configuration</CardTitle>
          <CardDescription>Configure how penalty points translate into salary deductions during payroll generation.</CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <Alert className="bg-blue-50 text-blue-800 border-blue-200">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertTitle>How Penalty Deductions Work</AlertTitle>
            <AlertDescription>
              Penalty points are accumulated automatically when employees miss work verifications. 
              The deduction is applied in <strong>bulk</strong> — not per point.
              For example, if the threshold is <strong>{threshold}</strong> points and the deduction is <strong>Rs. {amount.toLocaleString()}</strong>, 
              then an employee with <strong>{threshold * 2 + 5}</strong> points will only have <strong>Rs. {(amount * 2).toLocaleString()}</strong> deducted (2 complete bulks).
            </AlertDescription>
          </Alert>

          <div className="max-w-lg space-y-5">
            <Input 
              label="Penalty Point Threshold (points per bulk)"
              type="number"
              min="1"
              required
              value={penaltyThreshold}
              onChange={(e) => setPenaltyThreshold(e.target.value)}
              placeholder="e.g. 10"
            />

            <Input 
              label="Deduction Amount per Bulk (in LKR)"
              type="number"
              min="0"
              required
              value={penaltyAmount}
              onChange={(e) => setPenaltyAmount(e.target.value)}
              placeholder="e.g. 1000"
            />

            {/* Live Preview */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" /> Live Preview
              </h4>
              <div className="space-y-1 text-sm text-slate-600">
                <p>Employee with <strong className="text-slate-900">{threshold - 1}</strong> points → <strong className="text-emerald-600">Rs. 0</strong> deducted</p>
                <p>Employee with <strong className="text-slate-900">{threshold}</strong> points → <strong className="text-red-600">Rs. {amount.toLocaleString()}</strong> deducted</p>
                <p>Employee with <strong className="text-slate-900">{threshold * 2 + 5}</strong> points → <strong className="text-red-600">Rs. {(amount * 2).toLocaleString()}</strong> deducted</p>
                <p>Employee with <strong className="text-slate-900">{threshold * 3}</strong> points → <strong className="text-red-600">Rs. {(amount * 3).toLocaleString()}</strong> deducted</p>
              </div>
            </div>
            
            <Button 
              onClick={() => saveMutation.mutate()} 
              isLoading={saveMutation.isPending}
              className="w-full sm:w-auto shadow-lg shadow-blue-500/20"
            >
              <Save className="w-4 h-4 mr-2" /> Save Settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
