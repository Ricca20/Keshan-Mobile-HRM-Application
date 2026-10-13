'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, Trash2, MapPin, Wifi, Store, ShieldAlert, Users } from 'lucide-react'
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
  employeeCount?: number
  recentDenied?: { ip: string, rule: string, attempts: number, lastAt: string }[]
}

/** Adds an IP rule to a comma-separated list (replacing BYPASS), skipping duplicates. */
function addIpRule(list: string | undefined, rule: string) {
  const current = (list ?? '').split(',').map(s => s.trim()).filter(s => s && s !== 'BYPASS')
  return current.includes(rule) ? current.join(', ') : [...current, rule].join(', ')
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
      setShowForm(false)
      setIsEditing(null)
      setFormData({})
      toast.success('Shop saved successfully')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    }
  })

  const allowIpMutation = useMutation({
    mutationFn: async ({ shop, rule }: { shop: Shop, rule: string }) => {
      const res = await fetch(`/api/shops/${shop.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: shop.name, address: shop.address, allowedIp: addIpRule(shop.allowedIp, rule) }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to update shop')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shops'] })
      toast.success('Network allowed. Employees on it can clock in now.')
    },
    onError: (err: Error) => toast.error(err.message)
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
    onError: (err: Error) => {
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

                <div className="space-y-1.5 md:col-span-2">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <Wifi className="w-4 h-4 text-blue-500" /> Allowed IP Address(es)
                    </label>
                    <div className="flex gap-2">
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        onClick={async () => {
                          try {
                            const res = await fetch('/api/ip')
                            const data = await res.json()
                            if (!res.ok || !data.rule) throw new Error()
                            setFormData({...formData, allowedIp: addIpRule(formData.allowedIp, data.rule)})
                            toast.success(`Added ${data.rule}. Remember to click Save.`)
                          } catch {
                            toast.error('Failed to fetch IP. Visit whatismyip.com manually.')
                          }
                        }}
                        className="h-8 text-xs bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:border-blue-300 transition-colors"
                      >
                        <Wifi className="w-3 h-3 mr-1" /> Auto-Detect My IP
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                          setFormData({...formData, allowedIp: 'BYPASS'})
                          toast.success('IP Check Disabled! Remember to click Save.')
                        }}
                        className="h-8 text-xs bg-red-50 text-red-700 border-red-200 hover:bg-red-100 hover:border-red-300 transition-colors"
                      >
                        Disable IP Check
                      </Button>
                    </div>
                  </div>
                  <div className="relative">
                    <input
                      required
                      className="block w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none hover:border-slate-400 transition-all"
                      placeholder="e.g. 203.0.113.1, 2402:d000:1234:5678::/64" 
                      value={formData.allowedIp || ''} 
                      onChange={e => setFormData({...formData, allowedIp: e.target.value})}
                    />
                  </div>
                  <div className="text-xs text-slate-500 space-y-1 mt-1">
                    <p>Employees must be connected to one of these IPs or ranges. Use commas for several. Auto-Detect adds the network you are on now (for IPv6 it adds the whole /64 range, because phones change their IPv6 address regularly). Detect on both a phone and a laptop connected to the shop WiFi.</p>
                    <p className="text-amber-600 bg-amber-50 p-2 rounded-lg border border-amber-100 mt-2">
                      <strong>SLT Users:</strong> If employees can't clock in, connect your phone to the shop WiFi, click "Auto-Detect My IP" above, and save. You can also manually check your IP at <a href="https://whatismyip.com" target="_blank" rel="noopener noreferrer" className="underline font-semibold hover:text-amber-800">whatismyip.com</a>.
                    </p>
                  </div>
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
        <div className="grid gap-5 grid-cols-[repeat(auto-fill,minmax(min(100%,20rem),1fr))]">
          {shops.map(shop => {
            const bypass = shop.allowedIp.trim() === 'BYPASS'
            const networks = bypass ? [] : shop.allowedIp.split(',').map(ip => ip.trim()).filter(Boolean)
            const denied = bypass ? [] : shop.recentDenied ?? []

            return (
              <Card key={shop.id} className="flex flex-col border-slate-200 hover:shadow-md transition-shadow">
                <CardContent className="p-5 flex flex-col gap-4 h-full">
                  <div className="flex items-start gap-3">
                    <div className="h-11 w-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <Store className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-slate-900 leading-snug break-words">{shop.name}</h3>
                      <p className="mt-1 flex items-start gap-1 text-sm text-slate-500">
                        <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span className="line-clamp-2 break-words">{shop.address}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">
                      <Users className="w-3 h-3" />
                      {shop.employeeCount ?? 0} {shop.employeeCount === 1 ? 'employee' : 'employees'}
                    </Badge>
                    {bypass ? (
                      <Badge variant="danger" dot>WiFi check off</Badge>
                    ) : (
                      <Badge variant="success" dot>WiFi check on</Badge>
                    )}
                  </div>

                  {bypass ? (
                    <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-xl p-3">
                      Staff can clock in from any network. Edit the shop and add its WiFi to turn the check back on.
                    </p>
                  ) : (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                        <Wifi className="w-3.5 h-3.5" /> Allowed {networks.length === 1 ? 'network' : 'networks'}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {networks.map(ip => (
                          <span key={ip} className="font-mono text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 max-w-full break-all">
                            {ip}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {denied.length > 0 && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs space-y-2.5">
                      <div>
                        <p className="font-semibold text-amber-800 flex items-center gap-1.5">
                          <ShieldAlert className="w-3.5 h-3.5 shrink-0" /> Clock-ins denied in the last 48h
                        </p>
                        <p className="text-amber-700 mt-1">If these came from the shop WiFi, its internet IP has changed. Allow it so staff can clock in.</p>
                      </div>
                      {denied.map(d => (
                        <div key={d.ip} className="flex items-center justify-between gap-3 rounded-lg bg-white/70 border border-amber-100 px-2.5 py-2">
                          <div className="min-w-0">
                            <p className="font-mono text-slate-800 break-all">{d.ip}</p>
                            <p className="text-slate-500">
                              {d.attempts} {d.attempts === 1 ? 'attempt' : 'attempts'} · last {new Date(d.lastAt).toLocaleTimeString('en-US', { timeZone: 'Asia/Colombo', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs shrink-0 bg-white"
                            isLoading={allowIpMutation.isPending && allowIpMutation.variables?.rule === d.rule}
                            onClick={() => allowIpMutation.mutate({ shop, rule: d.rule })}
                          >
                            Allow
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-auto pt-4 border-t border-slate-100 flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEdit(shop)}>
                      <Edit2 className="h-3.5 w-3.5 mr-1.5" /> Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                      onClick={() => handleDelete(shop.id)}
                      aria-label={`Delete ${shop.name}`}
                      title="Delete shop"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
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
