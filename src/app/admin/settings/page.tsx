'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Settings, Save, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'

export default function AdminSettingsPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  
  const [penaltyAmount, setPenaltyAmount] = useState('500')

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await fetch('/api/settings')
      if (!res.ok) throw new Error('Failed to fetch settings')
      return res.json()
    }
  })

  useEffect(() => {
    if (settings && settings.PENALTY_AMOUNT) {
      setPenaltyAmount(settings.PENALTY_AMOUNT)
    }
  }, [settings])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ PENALTY_AMOUNT: penaltyAmount })
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
          <CardTitle className="text-lg font-bold text-slate-900">Payroll Configuration</CardTitle>
          <CardDescription>Configure rules used by the automated payroll engine.</CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <Alert className="bg-blue-50 text-blue-800 border-blue-200">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertTitle>Penalty Deductions</AlertTitle>
            <AlertDescription>
              Employees accumulate penalty points if they miss active work verifications. This setting defines how much money is deducted from their base salary for each point they accumulate during a month.
            </AlertDescription>
          </Alert>

          <div className="max-w-md space-y-4">
            <Input 
              label="Penalty Deduction Amount (per point) in LKR"
              type="number"
              min="0"
              required
              value={penaltyAmount}
              onChange={(e) => setPenaltyAmount(e.target.value)}
              placeholder="e.g. 500"
            />
            
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
