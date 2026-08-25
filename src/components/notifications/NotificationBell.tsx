'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Check, Clock, FileText, CalendarDays, Receipt, ShieldAlert } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useSession } from 'next-auth/react'

type Notification = {
  id: string
  title: string
  message: string
  type: string
  isRead: boolean
  createdAt: string
}

function getNotificationRoute(type: string, role: string): string | null {
  if (role === 'ADMIN') {
    switch (type) {
      case 'LEAVE_REQUEST': return '/admin/leave'
      case 'LEAVE_APPROVED': return '/admin/leave'
      case 'LEAVE_REJECTED': return '/admin/leave'
      case 'PAYROLL': return '/admin/paysheets'
      case 'VERIFICATION_MISSED': return '/admin/verification'
      case 'SYSTEM': return '/admin/dashboard'
      default: return '/admin/dashboard'
    }
  } else {
    switch (type) {
      case 'LEAVE_APPROVED': return '/employee/leave'
      case 'LEAVE_REJECTED': return '/employee/leave'
      case 'PAYROLL': return '/employee/paysheets'
      case 'SYSTEM': return '/employee/dashboard'
      default: return '/employee/dashboard'
    }
  }
}

export function NotificationBell() {
  const router = useRouter()
  const { data: session } = useSession()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const role = (session?.user as any)?.role || 'EMPLOYEE'

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications')
      if (res.ok) {
        const data = await res.json()
        setNotifications(data)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 60000)
    return () => clearInterval(interval)
  }, [])

  const handleNotificationClick = async (n: Notification) => {
    // Mark as read
    if (!n.isRead) {
      setNotifications(prev => 
        prev.map(item => item.id === n.id ? { ...item, isRead: true } : item)
      )
      try {
        await fetch(`/api/notifications/${n.id}`, { method: 'PATCH' })
      } catch {
        fetchNotifications()
      }
    }

    // Navigate
    const route = getNotificationRoute(n.type, role)
    if (route) {
      setOpen(false)
      router.push(route)
    }
  }

  const unreadCount = notifications.filter(n => !n.isRead).length

  const getIcon = (type: string) => {
    switch (type) {
      case 'LEAVE_REQUEST': return <CalendarDays className="w-4 h-4 text-amber-500" />
      case 'LEAVE_APPROVED': return <Check className="w-4 h-4 text-emerald-500" />
      case 'LEAVE_REJECTED': return <Check className="w-4 h-4 text-red-500" />
      case 'PAYROLL': return <Receipt className="w-4 h-4 text-blue-500" />
      case 'VERIFICATION_MISSED': return <ShieldAlert className="w-4 h-4 text-orange-500" />
      case 'SYSTEM': return <FileText className="w-4 h-4 text-slate-500" />
      default: return <FileText className="w-4 h-4 text-slate-500" />
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative p-2 text-slate-400 hover:text-slate-600 transition-colors rounded-full hover:bg-slate-100">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 shadow-lg border-slate-200 rounded-xl overflow-hidden z-50 bg-white">
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h4 className="font-bold text-slate-900 text-sm">Notifications</h4>
          {unreadCount > 0 && (
            <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">
              {unreadCount} new
            </span>
          )}
        </div>
        
        <div className="max-h-[300px] overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-slate-400 text-sm">Loading...</div>
          ) : notifications.length === 0 ? (
            <div className="p-6 text-center text-slate-400 flex flex-col items-center">
              <Bell className="w-8 h-8 text-slate-200 mb-2" />
              <p className="text-sm">No notifications yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {notifications.map(n => (
                <div 
                  key={n.id} 
                  className={cn(
                    "p-4 hover:bg-slate-50 transition-colors cursor-pointer flex gap-3 relative group",
                    !n.isRead && "bg-blue-50/30"
                  )}
                  onClick={() => handleNotificationClick(n)}
                >
                  {!n.isRead && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-r-full" />
                  )}
                  <div className={cn("mt-0.5 p-2 rounded-full shrink-0", !n.isRead ? "bg-white shadow-sm border border-slate-100" : "bg-slate-100")}>
                    {getIcon(n.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-semibold truncate", !n.isRead ? "text-slate-900" : "text-slate-600")}>
                      {n.title}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                      {n.message}
                    </p>
                    <p className="text-[10px] font-medium text-slate-400 mt-1.5 flex items-center gap-1 uppercase tracking-wider">
                      <Clock className="w-3 h-3" />
                      {new Date(n.createdAt).toLocaleDateString('en-US', { timeZone: 'Asia/Colombo' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
