'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, Trash2, MapPin, Wifi, Store } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'
import { ConfirmModal } from '@/components/ui/modal'

type Shop = {
  id: string
  name: string
  address: string
  allowedIp: string
}

export default function AdminShopsPage() {
  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState<string | null>(null)
  const [formData, setFormData] = useState<Partial<Shop>>({})
  const [showForm, setShowForm] = useState(false)
  const toast = useToast()
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean, id: string }>({
    isOpen: false,
    id: ''
  })

  const { data: shops = [], isLoading } = useQuery<Shop[]>({
    queryKey: ['shops'],
    queryFn: async () => {
      const res = await fetch('/api/shops')
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    }
  })

  const saveMutation = useMutation({
    mutationFn: async (shop: Partial<Shop>) => {
      const url = shop.id ? `/api/shops/${shop.id}` : '/api/shops'
      const method = shop.id ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shop),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to save')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shops'] })
      queryClient.invalidateQueries({ queryKey: ['shops'] })
      setShowForm(false)
      setIsEditing(null)
      setFormData({})
      toast.success('Shop saved successfully')
    },
    onError: (err: any) => {
      toast.error(err.message)
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/shops/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to delete')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shops'] })
      toast.success('Shop deleted successfully')
    },
    onError: (err: any) => {
      toast.error(err.message)
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    saveMutation.mutate(formData)
  }

  const handleEdit = (shop: Shop) => {
    setFormData(shop)
    setIsEditing(shop.id)
    setShowForm(true)
  }

  const handleDelete = (id: string) => {
    setConfirmState({ isOpen: true, id })
  }

  const onConfirmDelete = () => {
    deleteMutation.mutate(confirmState.id)
    setConfirmState(prev => ({ ...prev, isOpen: false }))
  }

  const handleAddNew = () => {
    setFormData({})
    setIsEditing(null)
    setShowForm(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Shops</h1>
          <p className="text-slate-500 text-sm mt-1">Manage your store locations and security boundaries.</p>
        </div>
        {!showForm && (
          <Button onClick={handleAddNew} className="w-full sm:w-auto shadow-lg shadow-blue-500/20">
            <Plus className="mr-2 h-4 w-4" /> Add Shop
          </Button>
        )}
      </div>

      {showForm && (
        <Card className="border-blue-100 shadow-xl shadow-blue-900/5 animate-fade-in">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-6 rounded-t-2xl">
            <CardTitle>{isEditing ? 'Edit Shop' : 'Add New Shop'}</CardTitle>
            <CardDescription>Configure the shop's physical location and authorized Wi-Fi network.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input 
                  label="Shop Name"
                  required
                  placeholder="Main Branch" 
                  value={formData.name || ''} 
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
                
                <Input 
                  label="Address"
                  required
                  placeholder="123 Main St, Colombo" 
                  value={formData.address || ''} 
                  onChange={e => setFormData({...formData, address: e.target.value})}
                />

                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Wifi className="w-4 h-4 text-blue-500" /> Allowed IP Address
                  </label>
                  <div className="relative">
                    <input
                      required
                      className="block w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none hover:border-slate-400 transition-all"
                      placeholder="203.0.113.1" 
                      value={formData.allowedIp || ''} 
                      onChange={e => setFormData({...formData, allowedIp: e.target.value})}
                    />
                  </div>
                  <p className="text-xs text-slate-500">Employees must be connected to this IP to clock in.</p>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={saveMutation.isPending} className="px-8 shadow-lg shadow-blue-500/20">
                  {saveMutation.isPending ? 'Saving...' : 'Save Shop'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {shops.map(shop => (
            <Card key={shop.id} className="hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 group overflow-hidden border-slate-200">
              <div className="h-1.5 w-full bg-gradient-to-r from-blue-400 to-indigo-500" />
              <CardHeader className="pb-4">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 text-blue-500 rounded-lg">
                      <Store className="w-5 h-5" />
                    </div>
                    <CardTitle className="text-lg font-bold text-slate-900">
                      {shop.name}
                    </CardTitle>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50" onClick={() => handleEdit(shop)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(shop.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <CardDescription className="flex items-start gap-1.5 mt-3 text-slate-500">
                  <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="line-clamp-2">{shop.address}</span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-100 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Network IP:</span>
                    <Badge variant="secondary" className="font-mono text-xs bg-white border-slate-200">{shop.allowedIp}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {shops.length === 0 && !showForm && (
            <div className="col-span-full text-center p-16 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
              <Store className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <h3 className="text-lg font-semibold text-slate-900">No shops configured</h3>
              <p className="text-sm text-slate-500 mb-6">Add your first shop to start managing employees.</p>
              <Button onClick={handleAddNew} className="shadow-lg shadow-blue-500/20">Add Your First Shop</Button>
            </div>
          )}
        </div>
      )}

      <ConfirmModal 
        isOpen={confirmState.isOpen}
        onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
        onConfirm={onConfirmDelete}
        title="Delete Shop"
        description="Are you sure you want to delete this shop? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}
