'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import Link from 'next/link'
import {
  LayoutDashboard,
  Clock,
  Calendar,
  TreePalm,
  Receipt,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Fingerprint,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { VerificationListener } from '@/components/verification/VerificationListener'
import Image from 'next/image'

const navItems = [
  { label: 'Dashboard', href: '/employee/dashboard', icon: LayoutDashboard },
  { label: 'Clock', href: '/employee/clock', icon: Clock },
  { label: 'Leave', href: '/employee/leave', icon: TreePalm },
  { label: 'Paysheets', href: '/employee/paysheet', icon: Receipt },
]

export default function EmployeeLayout({
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
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-200 shadow-[2px_0_12px_rgba(0,0,0,0.03)] transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:z-auto',
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
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                Employee Portal
              </p>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="ml-auto lg:hidden text-slate-400 hover:text-slate-600 hover:bg-slate-50 p-1.5 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Nav links */}
          <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1.5">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== '/employee/dashboard' &&
                  pathname.startsWith(item.href))
              const Icon = item.icon

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-200 group',
                    isActive
                      ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                  )}
                >
                  <Icon
                    className={cn(
                      'w-[20px] h-[20px] shrink-0 transition-colors',
                      isActive
                        ? 'text-white'
                        : 'text-slate-400 group-hover:text-blue-500'
                    )}
                  />
                  {item.label}
                  {isActive && (
                    <ChevronRight className="w-4 h-4 ml-auto opacity-70" />
                  )}
                </Link>
              )
            })}
          </nav>

          {/* User section */}
          <div className="border-t border-slate-200 p-4">
            <div className="flex items-center gap-3 px-2 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold border border-blue-200 shrink-0">
                {session?.user?.name?.charAt(0) ?? 'E'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900 truncate">
                  {session?.user?.name ?? 'Employee'}
                </p>
                <Badge variant="secondary" className="text-[10px] uppercase font-bold mt-0.5 tracking-wider">
                  Employee
                </Badge>
              </div>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all duration-200 cursor-pointer border border-transparent hover:border-red-100"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar (Visible mainly on mobile or for context) */}
        <header className="flex items-center gap-4 px-4 lg:px-8 py-4 border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-slate-500 hover:text-slate-700 hover:bg-slate-100 p-1.5 rounded-lg transition-colors border border-slate-200"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1" />
          <NotificationBell />
          <span className="text-sm font-semibold text-slate-500 hidden sm:block">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8 relative">
          {children}
        </main>
      </div>

      {/* Global verification listener */}
      <VerificationListener />
    </div>
  )
}
