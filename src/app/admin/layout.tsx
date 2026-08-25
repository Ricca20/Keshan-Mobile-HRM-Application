'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import Link from 'next/link'
import {
  LayoutDashboard,
  Users,
  Store,
  Clock,
  Calendar,
  TreePalm,
  Receipt,
  BarChart3,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Fingerprint,
  ShieldAlert,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import Image from 'next/image'

const navItems = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'Employees', href: '/admin/employees', icon: Users },
  { label: 'Shops', href: '/admin/shops', icon: Store },
  { label: 'Attendance', href: '/admin/attendance', icon: Clock },
  { label: 'Verification', href: '/admin/verification', icon: ShieldAlert },
  { label: 'Leave', href: '/admin/leave', icon: TreePalm },
  { label: 'Paysheets', href: '/admin/paysheets', icon: Receipt },
  { label: 'Reports', href: '/admin/reports', icon: BarChart3 },
  { label: 'Settings', href: '/admin/settings', icon: Settings },
]

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const { data: session } = useSession()

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-200 shadow-sm transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:z-auto',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-200">
            <div className="relative w-12 h-12 rounded-xl bg-white shadow-sm border border-slate-200 overflow-hidden shrink-0">
              <Image src="/images/logo.jpg" alt="PhoneShop HRM" fill sizes="48px" className="object-cover" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 text-lg tracking-tight leading-tight">
                PhoneShop <span className="text-blue-500">HRM</span>
              </h1>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-medium">
                Admin Panel
              </p>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="ml-auto lg:hidden text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Nav links */}
          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== '/admin/dashboard' &&
                  pathname.startsWith(item.href))
              const Icon = item.icon

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group',
                    isActive
                      ? 'bg-blue-50 text-blue-600 border border-blue-100'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  )}
                >
                  <Icon
                    className={cn(
                      'w-[18px] h-[18px] shrink-0',
                      isActive
                        ? 'text-blue-500'
                        : 'text-slate-400 group-hover:text-slate-600'
                    )}
                  />
                  {item.label}
                  {isActive && (
                    <ChevronRight className="w-4 h-4 ml-auto text-blue-400" />
                  )}
                </Link>
              )
            })}
          </nav>

          {/* User section */}
          <div className="border-t border-slate-200 p-4">
            <div className="flex items-center gap-3 px-2 mb-3">
              <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-bold shadow-sm">
                {session?.user?.name?.charAt(0) ?? 'A'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {session?.user?.name ?? 'Admin'}
                </p>
                <Badge variant="info" size="sm">
                  Admin
                </Badge>
              </div>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="flex items-center gap-2 w-full px-4 py-2 rounded-xl text-sm text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all duration-200 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center gap-4 px-4 lg:px-8 py-4 border-b border-slate-200 bg-white">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-slate-500 hover:text-slate-700 transition-colors p-1"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex-1" />
          <NotificationBell />
          <span className="text-xs text-slate-500 hidden sm:block">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
