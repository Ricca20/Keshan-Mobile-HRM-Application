'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, Ban, CheckCircle2, User, Building, Banknote } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'
import { ConfirmModal } from '@/components/ui/modal'

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
  createdAt: string
}

export default function AdminEmployeesPage() {
  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState<string | null>(null)
  const [formData, setFormData] = useState<Partial<Employee>>({})
  const [showForm, setShowForm] = useState(false)
  const toast = useToast()
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {employees.map(employee => (
            <Card key={employee.id} className={`hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 ${!employee.isActive ? 'opacity-70 bg-slate-50' : 'bg-white'}`}>
              <CardContent className="p-5 flex flex-col h-full">
                <div className="flex items-start justify-between mb-4">
                  <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 ${employee.isActive ? 'bg-blue-50 text-blue-500' : 'bg-slate-200 text-slate-400'}`}>
                    <User className="h-6 w-6" />
                  </div>
                  {!employee.isActive && <Badge variant="destructive" size="sm">Inactive</Badge>}
                </div>
                
                <div className="mb-4">
                  <h3 className="font-bold text-slate-900 truncate" title={employee.name}>
                    {employee.name}
                  </h3>
                  <p className="text-xs text-slate-500 truncate" title={employee.email}>{employee.email}</p>
                </div>

                <div className="space-y-2 text-sm mt-auto mb-5 bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 flex items-center gap-1.5"><Building className="h-3.5 w-3.5" /> Shop</span>
                    <span className="font-medium text-slate-700">{employee.shop?.name || 'Unassigned'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 flex items-center gap-1.5"><Banknote className="h-3.5 w-3.5" /> Salary</span>
                    <span className="font-medium text-slate-700">Rs. {employee.salary.toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex gap-2 justify-end mt-auto pt-4 border-t border-slate-100">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEdit(employee)}>
                    <Edit2 className="h-3.5 w-3.5 mr-1.5" /> Edit
                  </Button>
                  {employee.isActive ? (
                    <Button variant="outline" size="sm" className="flex-1 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200" onClick={() => handleToggleActive(employee.id, true)}>
                      <Ban className="h-3.5 w-3.5 mr-1.5" /> Deactivate
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" className="flex-1 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200" onClick={() => handleToggleActive(employee.id, false)}>
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
