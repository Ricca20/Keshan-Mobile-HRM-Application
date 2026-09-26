'use client'

import { useQuery } from '@tanstack/react-query'
import { FileText, CalendarDays, Wallet, TrendingDown, TrendingUp, Download } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useState } from 'react'
import { formatCurrency } from '@/lib/utils'

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
  status: 'DRAFT' | 'FINALIZED'
  finalizedAt: string
}

export default function EmployeePaysheetsPage() {
  const [selectedPaysheet, setSelectedPaysheet] = useState<PaySheet | null>(null)

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
    </div>
  )
}
