'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FileText, Download, PlayCircle, Eye, Calculator } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { useToast } from '@/components/ui/toast'

type PaySheet = {
  id: string
  user: { name: string, shop: { name: string } }
  month: number
  year: number
  baseSalary: number
  netPay: number
  status: 'DRAFT' | 'FINALIZED'
}

export default function AdminPaysheetsPage() {
  const queryClient = useQueryClient()
  const today = new Date()
  const [filterMonth, setFilterMonth] = useState(today.getMonth() + 1)
  const [filterYear, setFilterYear] = useState(today.getFullYear())
  const toast = useToast()

  const { data: paysheets = [], isLoading } = useQuery<PaySheet[]>({
    queryKey: ['paysheets', filterMonth, filterYear],
    queryFn: async () => {
      const res = await fetch(`/api/paysheets?month=${filterMonth}&year=${filterYear}`)
      if (!res.ok) throw new Error('Failed to fetch paysheets')
      return res.json()
    }
  })

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/paysheets/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: filterMonth, year: filterYear })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to generate')
      return data
    },
    onSuccess: (data) => {
      toast.success(data.message)
      queryClient.invalidateQueries({ queryKey: ['paysheets'] })
    },
    onError: (err: any) => toast.error(err.message)
  })

  const handleExport = () => {
    window.location.href = `/api/paysheets/export?month=${filterMonth}&year=${filterYear}`
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Paysheets</h1>
          <p className="text-slate-500 text-sm mt-1">Generate, review, and finalize monthly payroll.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200 flex-1 md:flex-none">
            <select 
              className="bg-transparent border-none focus:ring-0 text-sm font-medium text-slate-700 outline-none px-2 py-1 flex-1 cursor-pointer"
              value={filterMonth} 
              onChange={(e) => setFilterMonth(Number(e.target.value))}
            >
              {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{new Date(2000, m - 1).toLocaleString('default', { month: 'long' })}</option>
              ))}
            </select>
            <div className="w-px h-5 bg-slate-200 hidden sm:block"></div>
            <input 
              type="number" 
              className="w-20 bg-transparent border-none focus:ring-0 text-sm font-medium text-slate-700 outline-none px-2 py-1 text-center"
              value={filterYear}
              onChange={(e) => setFilterYear(Number(e.target.value))}
            />
          </div>
          <Button variant="outline" onClick={handleExport} disabled={paysheets.length === 0} className="w-full sm:w-auto">
            <Download className="w-4 h-4 mr-2" /> Export
          </Button>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 bg-slate-50/50 border-b border-slate-100">
          <div>
            <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-slate-400" /> Paysheets Overview
            </CardTitle>
            <CardDescription>Showing records for {new Date(2000, filterMonth - 1).toLocaleString('default', { month: 'long' })} {filterYear}</CardDescription>
          </div>
          <Button 
            onClick={() => generateMutation.mutate()} 
            isLoading={generateMutation.isPending}
            className="w-full sm:w-auto mt-4 sm:mt-0 shadow-lg shadow-blue-500/20"
          >
            <Calculator className="w-4 h-4 mr-2" /> Generate Paysheets
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : paysheets.length === 0 ? (
            <div className="text-center p-16 text-slate-400 bg-slate-50/50">
              <PlayCircle className="w-12 h-12 mx-auto mb-4 opacity-20 text-slate-500" />
              <h3 className="text-lg font-semibold text-slate-900">No paysheets found</h3>
              <p className="text-sm mt-1">Click "Generate Paysheets" to calculate payroll for this month.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-xs uppercase tracking-wider font-bold text-slate-500 whitespace-nowrap">
                    <th className="px-6 py-4">Employee</th>
                    <th className="px-6 py-4">Shop</th>
                    <th className="px-6 py-4">Base Salary</th>
                    <th className="px-6 py-4">Net Pay</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {paysheets.map(ps => (
                    <tr key={ps.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-bold text-slate-900">{ps.user.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-slate-500 bg-slate-100 inline-block px-2.5 py-1 rounded-md">{ps.user.shop.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-600">
                        Rs. {ps.baseSalary.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-lg">Rs. {ps.netPay.toLocaleString()}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={ps.status === 'FINALIZED' ? 'success' : 'warning'} className="uppercase tracking-wider font-bold text-[10px]">
                          {ps.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <Link href={`/admin/paysheets/${ps.id}`}>
                          <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <Eye className="w-4 h-4 mr-2 text-slate-400" /> View Details
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
