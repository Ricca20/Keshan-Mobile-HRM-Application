'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ShieldCheck,
  ArrowLeft,
  Wifi,
  Clock,
  TreePalm,
  Receipt,
  CheckCircle2,
  Fingerprint,
} from 'lucide-react'
import Image from 'next/image'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const res = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (res?.error) {
        setError('Invalid email or password. Please try again.')
      } else {
        router.push('/')
        router.refresh()
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Panel — Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800">
        {/* Decorative shapes */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 -left-32 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-blue-400/10 rounded-full blur-3xl" />
          {/* Grid pattern overlay */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `radial-gradient(circle, white 1px, transparent 1px)`,
              backgroundSize: '24px 24px',
            }}
          />
        </div>

        <div className="relative z-10 flex flex-col justify-between w-full p-12 xl:p-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="relative w-12 h-12 rounded-xl overflow-hidden shadow-lg border border-white/20">
                <Image src="/images/logo.jpg" alt="PhoneShop HRM" fill sizes="48px" className="object-cover" />
              </div>
              <div>
                <h1 className="font-bold text-white text-xl tracking-tight">
                  PhoneShop <span className="text-blue-200">HRM</span>
                </h1>
                <p className="text-[10px] text-blue-300 uppercase tracking-widest font-medium">
                  Human Resource Management
                </p>
              </div>
            </Link>
          </div>

          {/* Center content */}
          <div className="flex-1 flex flex-col justify-center max-w-md">
            <h2 className="text-3xl xl:text-4xl font-black text-white tracking-tight leading-tight mb-4">
              Manage your
              <span className="block text-blue-200">entire workforce</span>
              from one place.
            </h2>
            <p className="text-blue-200/80 text-base leading-relaxed mb-10">
              Clock-in, leave management, payroll automation, and real-time verification — all in one beautiful dashboard.
            </p>

            {/* Feature checklist */}
            <div className="space-y-4">
              {[
                { icon: Wifi, text: 'WiFi-based IP attendance tracking' },
                { icon: Fingerprint, text: 'Random active work verification' },
                { icon: TreePalm, text: 'Smart leave management with auto-skip weekends' },
                { icon: Receipt, text: 'One-click automated payroll generation' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 group">
                  <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/10 border border-white/10 group-hover:bg-white/15 transition-colors">
                    <item.icon className="w-4 h-4 text-blue-200" />
                  </div>
                  <span className="text-sm text-white/80 font-medium">{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom */}
          <div className="flex items-center gap-2 text-blue-300/60 text-xs">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Secured with NextAuth · IP-verified attendance</span>
          </div>
        </div>
      </div>

      {/* Right Panel — Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-4 sm:px-8 py-12 relative bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
        {/* Decorative blurs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -right-24 w-72 h-72 bg-blue-100/40 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-sky-100/40 rounded-full blur-3xl" />
        </div>

        <div className="w-full max-w-md relative z-10 animate-fade-in">
          {/* Back to home (mobile + desktop) */}
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 font-medium mb-8 transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            Back to Home
          </Link>

          {/* Mobile logo (hidden on desktop) */}
          <div className="lg:hidden text-center mb-8">
            <div className="relative inline-block w-16 h-16 rounded-2xl overflow-hidden shadow-lg border border-slate-200 mb-4">
              <Image src="/images/logo.jpg" alt="PhoneShop HRM" fill sizes="64px" className="object-cover" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              PhoneShop <span className="text-blue-500">HRM</span>
            </h1>
          </div>

          {/* Header */}
          <div className="mb-8">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Welcome back
            </h2>
            <p className="text-slate-500 mt-2 text-sm">
              Sign in to your account to continue.
            </p>
          </div>

          {/* Login form */}
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-xl shadow-slate-200/50">
            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                id="email"
                label="Email Address"
                type="email"
                placeholder="you@phoneshop.lk"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
              />

              <div>
                <Input
                  id="password"
                  label="Password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <div className="flex justify-end mt-1.5">
                  <Link
                    href="/forgot-password"
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline transition-colors"
                  >
                    Forgot Password?
                  </Link>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full shadow-lg shadow-blue-500/20"
                size="lg"
                isLoading={isLoading}
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>
          </div>

          {/* Security footer */}
          <div className="text-center mt-6">
            <div className="inline-flex items-center gap-1.5 text-xs text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              IP verified attendance system
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
