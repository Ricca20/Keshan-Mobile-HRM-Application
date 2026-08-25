'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, Settings, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'

type LeaveType = {
  id: string
  name: string
  daysAllowed: number
  isPaid: boolean
  isActive: boolean
}

export default function LeaveTypesPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingType, setEditingType] = useState<LeaveType | null>(null)
  
  const [formData, setFormData] = useState({
    name: '',
    daysAllowed: 14,
    isPaid: true,
    isActive: true
  })

  const { data: types = [], isLoading } = useQuery<LeaveType[]>({
    queryKey: ['leaveTypes'],
    queryFn: async () => {
      const res = await fetch('/api/leave/types')
      if (!res.ok) throw new Error('Failed to fetch leave types')
      return res.json()
    }
  })

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const url = editingType ? `/api/leave/types/${editingType.id}` : '/api/leave/types'
      const method = editingType ? 'PUT' : 'POST'
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to save')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaveTypes'] })
      setIsModalOpen(false)
      setEditingType(null)
      toast.success('Leave type saved successfully')
    },
    onError: (err: any) => {
      toast.error(err.message)
    }
  })

  const rolloverMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/leave/rollover', { method: 'POST' })
      if (!res.ok) throw new Error('Failed to run rollover')
      return res.json()
    },
    onSuccess: (data) => {
      toast.success(`Successfully ran rollover. Created ${data.createdCount} new balances.`)
    },
    onError: (err: any) => {
      toast.error(err.message)
    }
  })

  const openModal = (type?: LeaveType) => {
    if (type) {
      setEditingType(type)
      setFormData({
        name: type.name,
        daysAllowed: type.daysAllowed,
        isPaid: type.isPaid,
        isActive: type.isActive
      })
    } else {
      setEditingType(null)
      setFormData({ name: '', daysAllowed: 14, isPaid: true, isActive: true })
    }
    setIsModalOpen(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    saveMutation.mutate(formData)
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Leave Types</h1>
          <p className="text-slate-500 text-sm mt-1">Manage leave policies and allowances.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto flex-col sm:flex-row">
          <Button 
            variant="outline" 
            onClick={() => {
              if (confirm('Are you sure you want to run the Annual Rollover? This will generate missing leave balances for all active employees for the current year.')) {
                rolloverMutation.mutate()
              }
            }} 
            disabled={rolloverMutation.isPending}
            className="w-full sm:w-auto border-blue-200 text-blue-700 hover:bg-blue-50"
          >
            {rolloverMutation.isPending ? 'Running...' : 'Run Annual Rollover'}
          </Button>
          <Button onClick={() => openModal()} className="shadow-lg shadow-blue-500/20 w-full sm:w-auto">
            <Plus className="w-4 h-4 mr-2" /> Add Leave Type
          </Button>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
          <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-slate-400" /> Configured Leave Types
          </CardTitle>
          <CardDescription>Changes to allowed days affect new balances.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {types.map(type => (
                <div key={type.id} className="flex items-center justify-between p-6 hover:bg-slate-50/50 transition-colors bg-white group">
                  <div className="flex items-start gap-4">
                    <div className="mt-0.5 bg-blue-50 text-blue-500 p-2.5 rounded-xl">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-3 mb-1">
                        <h3 className="font-bold text-lg text-slate-900">{type.name}</h3>
                        <Badge variant={type.isPaid ? 'success' : 'secondary'} className="uppercase tracking-wider font-bold">
                          {type.isPaid ? 'Paid' : 'Unpaid'}
                        </Badge>
                        {!type.isActive && <Badge variant="destructive" className="uppercase tracking-wider font-bold">Inactive</Badge>}
                      </div>
                      <p className="text-sm font-medium text-slate-500 mt-1">
                        <span className="text-slate-900 font-bold">{type.daysAllowed}</span> days allowed per year
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="text-slate-400 hover:text-blue-600 hover:bg-blue-50 opacity-0 group-hover:opacity-100 transition-all shrink-0" onClick={() => openModal(type)}>
                    <Edit2 className="w-5 h-5" />
                  </Button>
                </div>
              ))}
              {types.length === 0 && (
                <div className="p-16 text-center text-slate-400 bg-slate-50/50">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-20 text-slate-500" />
                  <p className="font-medium text-slate-500">No leave types configured.</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modern Modal overlay for forms */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-slide-in-left">
            <form onSubmit={handleSubmit}>
              <div className="p-6 md:p-8 border-b border-slate-100">
                <h2 className="text-2xl font-bold text-slate-900">{editingType ? 'Edit Leave Type' : 'New Leave Type'}</h2>
              </div>
              
              <div className="p-6 md:p-8 space-y-5 bg-slate-50/50">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Leave Name</label>
                  <input
                    type="text"
                    required
                    className="w-full p-3 rounded-xl border border-slate-200 bg-white text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Annual Leave"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Days Allowed per Year</label>
                  <input
                    type="number"
                    min="0"
                    required
                    className="w-full p-3 rounded-xl border border-slate-200 bg-white text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                    value={formData.daysAllowed}
                    onChange={e => setFormData({ ...formData, daysAllowed: parseInt(e.target.value) })}
                  />
                </div>
                
                <div className="flex items-center gap-3 bg-white p-4 rounded-xl border border-slate-200">
                  <input
                    type="checkbox"
                    id="isPaid"
                    className="w-5 h-5 rounded border-slate-300 text-blue-500 focus:ring-blue-500"
                    checked={formData.isPaid}
                    onChange={e => setFormData({ ...formData, isPaid: e.target.checked })}
                  />
                  <label htmlFor="isPaid" className="text-sm font-semibold text-slate-700 cursor-pointer">Is this Paid Leave?</label>
                </div>
                
                {editingType && (
                  <div className="flex items-center gap-3 bg-white p-4 rounded-xl border border-slate-200">
                    <input
                      type="checkbox"
                      id="isActive"
                      className="w-5 h-5 rounded border-slate-300 text-red-500 focus:ring-red-500"
                      checked={formData.isActive}
                      onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                    />
                    <label htmlFor="isActive" className="text-sm font-semibold text-red-600 cursor-pointer">Active Status</label>
                  </div>
                )}
              </div>
              
              <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-white">
                <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={saveMutation.isPending} className="px-6 shadow-lg shadow-blue-500/20">
                  Save Leave Type
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
