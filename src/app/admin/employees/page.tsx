'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, Ban, CheckCircle2, User, Building, Banknote, Send, Copy, MessageCircle, CalendarDays } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'
import { ConfirmModal, Modal } from '@/components/ui/modal'
import { formatCurrency } from '@/lib/utils'

type Shop = {
  id: string
  name: string
}

type Employee = {
  id: string
  name: string
  email: string
  salary: number
  shopId: string
  isActive: boolean
  shop?: Shop
  joinDate: string
  createdAt: string
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : parts[0]?.[1] ?? '')).toUpperCase()
}

export default function AdminEmployeesPage() {
  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState<string | null>(null)
  const [formData, setFormData] = useState<Partial<Employee>>({})
  const [showForm, setShowForm] = useState(false)
  const toast = useToast()
  const [invite, setInvite] = useState<{ name: string, url: string } | null>(null)
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean, id: string, currentStatus: boolean }>({
    isOpen: false,
    id: '',
    currentStatus: true
  })

  const { data: employees = [], isLoading: isLoadingEmployees } = useQuery<Employee[]>({
    queryKey: ['employees'],
    queryFn: async () => {
      const res = await fetch('/api/employees')
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    }
  })

  const { data: shops = [] } = useQuery<Shop[]>({
    queryKey: ['shops'],
    queryFn: async () => {
      const res = await fetch('/api/shops')
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    }
  })

  const saveMutation = useMutation({
    mutationFn: async (employee: Partial<Employee>) => {
      const url = employee.id ? `/api/employees/${employee.id}` : '/api/employees'
      const method = employee.id ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(employee),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to save')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      setShowForm(false)
      setIsEditing(null)
      setFormData({})
      toast.success('Employee saved successfully')
    },
    onError: (err: any) => {
      toast.error(err.message)
    }
  })

  const inviteMutation = useMutation({
    mutationFn: async (employee: Employee) => {
      const res = await fetch(`/api/employees/${employee.id}/invite`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to send setup link')
      return { name: employee.name, url: data.setupUrl as string }
    },
    onSuccess: (result) => {
      setInvite(result)
      toast.success('Setup email sent')
    },
    onError: (err: Error) => toast.error(err.message)
  })

  const copyInvite = async () => {
    if (!invite) return
    try {
      await navigator.clipboard.writeText(invite.url)
      toast.success('Link copied')
    } catch {
      toast.error('Could not copy. Select the link and copy it manually.')
    }
  }

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string, isActive: boolean }) => {
      const res = await fetch(`/api/employees/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      })
      if (!res.ok) throw new Error('Failed to update status')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      toast.success('Employee status updated')
    },
    onError: (err: any) => {
      toast.error(err.message)
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    saveMutation.mutate(formData)
  }

  const handleEdit = (employee: Employee) => {
    setFormData({
      id: employee.id,
      name: employee.name,
      email: employee.email,
      salary: employee.salary,
      shopId: employee.shopId,
      isActive: employee.isActive,
    })
    setIsEditing(employee.id)
    setShowForm(true)
  }

  const handleToggleActive = (id: string, currentStatus: boolean) => {
    setConfirmState({ isOpen: true, id, currentStatus })
  }

  const onConfirmToggle = () => {
    toggleActiveMutation.mutate({ id: confirmState.id, isActive: !confirmState.currentStatus })
    setConfirmState(prev => ({ ...prev, isOpen: false }))
  }

  const handleAddNew = () => {
    setFormData({ isActive: true, salary: 0, shopId: shops[0]?.id || '' })
    setIsEditing(null)
    setShowForm(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Employees</h1>
          <p className="text-slate-500 text-sm mt-1">Manage staff accounts, salaries, and shop assignments.</p>
        </div>
        {!showForm && (
          <Button onClick={handleAddNew} className="w-full sm:w-auto shadow-lg shadow-blue-500/20">
            <Plus className="mr-2 h-4 w-4" /> Add Employee
          </Button>
        )}
      </div>

      {showForm && (
        <Card className="border-blue-100 shadow-xl shadow-blue-900/5 animate-fade-in">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-6 rounded-t-2xl">
            <CardTitle>{isEditing ? 'Edit Employee' : 'Add New Employee'}</CardTitle>
            <CardDescription>
              {isEditing 
                ? "Update employee details." 
                : "Create a new employee account. An email will be sent to them to securely set their password."}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input 
                  label="Full Name"
                  required
                  placeholder="John Doe" 
                  value={formData.name || ''} 
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
                
                <Input 
                  label="Email Address"
                  required
                  type="email"
                  placeholder="john@phoneshop.lk" 
                  value={formData.email || ''} 
                  onChange={e => setFormData({...formData, email: e.target.value})}
                />
                


                <Input 
                  label="Monthly Salary (LKR)"
                  type="number"
                  required
                  min="0"
                  placeholder="50000" 
                  value={formData.salary === undefined ? '' : formData.salary} 
                  onChange={e => setFormData({...formData, salary: parseInt(e.target.value)})}
                />

                <div className="space-y-1.5 md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700">Assign to Shop</label>
                  <select 
                    required
                    className="block w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none hover:border-slate-400 transition-all"
                    value={formData.shopId || ''}
                    onChange={e => setFormData({...formData, shopId: e.target.value})}
                  >
                    <option value="" disabled>Select a shop...</option>
                    {shops.map(shop => (
                      <option key={shop.id} value={shop.id}>{shop.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={saveMutation.isPending} className="px-8 shadow-lg shadow-blue-500/20">
                  {saveMutation.isPending ? 'Saving...' : 'Save Employee'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoadingEmployees ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="grid gap-5 grid-cols-[repeat(auto-fill,minmax(min(100%,19rem),1fr))]">
          {employees.map(employee => (
            <Card key={employee.id} className={`flex flex-col border-slate-200 hover:shadow-md transition-shadow ${!employee.isActive ? 'bg-slate-50' : 'bg-white'}`}>
              <CardContent className="p-5 flex flex-col gap-4 h-full">
                <div className="flex items-start gap-3">
                  <div
                    aria-hidden
                    className={`h-11 w-11 rounded-full flex items-center justify-center shrink-0 text-sm font-bold ${employee.isActive ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-500'}`}
                  >
                    {initials(employee.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className={`font-bold leading-snug truncate ${employee.isActive ? 'text-slate-900' : 'text-slate-500'}`} title={employee.name}>
                      {employee.name}
                    </h3>
                    <p className="text-sm text-slate-500 truncate" title={employee.email}>{employee.email}</p>
                  </div>
                  <Badge variant={employee.isActive ? 'success' : 'secondary'} dot className="shrink-0">
                    {employee.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>

                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm rounded-xl bg-slate-50 border border-slate-100 p-3">
                  <div className="col-span-2 min-w-0">
                    <dt className="text-xs text-slate-500 flex items-center gap-1.5"><Building className="h-3.5 w-3.5 shrink-0" /> Shop</dt>
                    <dd className="font-medium text-slate-800 mt-0.5 break-words">{employee.shop?.name || 'Unassigned'}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-slate-500 flex items-center gap-1.5"><Banknote className="h-3.5 w-3.5 shrink-0" /> Salary</dt>
                    <dd className="font-medium text-slate-800 mt-0.5 tabular-nums">{formatCurrency(employee.salary)}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-slate-500 flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 shrink-0" /> Joined</dt>
                    <dd className="font-medium text-slate-800 mt-0.5">
                      {new Date(employee.joinDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Colombo' })}
                    </dd>
                  </div>
                </dl>

                <div className="mt-auto pt-4 border-t border-slate-100 space-y-2">
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 whitespace-nowrap" onClick={() => handleEdit(employee)}>
                      <Edit2 className="h-3.5 w-3.5 mr-1.5" /> Edit
                    </Button>
                    {employee.isActive && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 whitespace-nowrap"
                        title="Email a new password setup link (older links stop working)"
                        isLoading={inviteMutation.isPending && inviteMutation.variables?.id === employee.id}
                        onClick={() => inviteMutation.mutate(employee)}
                      >
                        <Send className="h-3.5 w-3.5 mr-1.5" /> Setup Link
                      </Button>
                    )}
                  </div>
                  {employee.isActive ? (
                    <Button variant="ghost" size="sm" className="w-full text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => handleToggleActive(employee.id, true)}>
                      <Ban className="h-3.5 w-3.5 mr-1.5" /> Deactivate
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" className="w-full text-emerald-700 border-emerald-200 hover:bg-emerald-50" onClick={() => handleToggleActive(employee.id, false)}>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Reactivate
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {employees.length === 0 && !showForm && (
            <div className="col-span-full text-center p-16 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
              <User className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <h3 className="text-lg font-semibold text-slate-900">No employees found</h3>
              <p className="text-sm text-slate-500 mb-6">Add your first employee to get started.</p>
              <Button onClick={handleAddNew} className="shadow-lg shadow-blue-500/20">Add Employee</Button>
            </div>
          )}
        </div>
      )}

      <Modal isOpen={invite !== null} onClose={() => setInvite(null)} title={`Setup link for ${invite?.name ?? ''}`}>
        {invite && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              A setup email was sent. If it doesn&apos;t arrive (check the spam folder), share this link directly.
              It works once and expires in 7 days.
            </p>
            <input
              readOnly
              value={invite.url}
              onFocus={e => e.target.select()}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono text-slate-700"
            />
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" className="flex-1" onClick={copyInvite}>
                <Copy className="w-4 h-4 mr-1.5" /> Copy Link
              </Button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Set up your staff account password: ${invite.url}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-4 py-2.5"
              >
                <MessageCircle className="w-4 h-4 mr-1.5" /> Share on WhatsApp
              </a>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal 
        isOpen={confirmState.isOpen}
        onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
        onConfirm={onConfirmToggle}
        title={confirmState.currentStatus ? 'Deactivate Employee' : 'Reactivate Employee'}
        description={`Are you sure you want to ${confirmState.currentStatus ? 'deactivate' : 'reactivate'} this employee?`}
        confirmText={confirmState.currentStatus ? 'Deactivate' : 'Reactivate'}
        variant={confirmState.currentStatus ? 'danger' : 'primary'}
        isLoading={toggleActiveMutation.isPending}
      />
    </div>
  )
}
