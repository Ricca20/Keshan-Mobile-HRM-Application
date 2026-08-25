import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
  Clock,
  ShieldCheck,
  TreePalm,
  Receipt,
  ArrowRight,
  Fingerprint,
  BarChart3,
  Smartphone,
  Wifi,
  CheckCircle2,
  Zap,
  Users,
  Store,
} from 'lucide-react'

export default async function HomePage() {
  const session = await auth()

  // If already logged in, redirect to dashboard
  if (session) {
    if ((session.user as any)?.role === 'ADMIN') {
      redirect('/admin/dashboard')
    }
    redirect('/employee/dashboard')
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="relative w-9 h-9 rounded-xl overflow-hidden shadow-sm border border-slate-200">
                <Image src="/images/logo.jpg" alt="PhoneShop HRM" fill sizes="36px" className="object-cover" />
              </div>
              <span className="font-bold text-slate-900 text-lg tracking-tight">
                PhoneShop <span className="text-blue-500">HRM</span>
              </span>
            </div>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 shadow-lg shadow-blue-500/25 transition-all hover:shadow-blue-500/40 hover:-translate-y-0.5"
            >
              Sign In <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-28 overflow-hidden">
        {/* Background decorations */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-gradient-to-br from-blue-100/70 to-sky-50/40 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-[400px] h-[400px] bg-gradient-to-tr from-indigo-100/50 to-blue-50/30 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-50/30 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-bold uppercase tracking-wider mb-8 animate-fade-in">
              <Zap className="w-3.5 h-3.5" />
              Smart HR Management for Phone Shops
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 leading-[1.1] mb-6 animate-fade-in">
              Manage your workforce
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                with confidence
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-slate-500 max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-in">
              The all-in-one HR platform built specifically for multi-location phone shops.
              Track attendance via WiFi, manage leave, automate payroll — all from one dashboard.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-blue-600 text-white text-base font-bold hover:bg-blue-700 shadow-xl shadow-blue-500/25 transition-all hover:shadow-blue-500/40 hover:-translate-y-0.5 w-full sm:w-auto justify-center"
              >
                Get Started <ArrowRight className="w-5 h-5" />
              </Link>
              <a
                href="#features"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-slate-100 text-slate-700 text-base font-bold hover:bg-slate-200 transition-all w-full sm:w-auto justify-center"
              >
                See Features
              </a>
            </div>
          </div>

          {/* Stats bar */}
          <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto animate-fade-in">
            {[
              { icon: Store, label: 'Multi-Shop', value: 'Support' },
              { icon: Wifi, label: 'WiFi-Based', value: 'Attendance' },
              { icon: ShieldCheck, label: 'Real-Time', value: 'Verification' },
              { icon: Receipt, label: 'Automated', value: 'Payroll' },
            ].map((stat, i) => (
              <div
                key={i}
                className="flex flex-col items-center gap-2 p-5 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300"
              >
                <div className="p-2.5 rounded-xl bg-blue-50 text-blue-500">
                  <stat.icon className="w-5 h-5" />
                </div>
                <span className="text-sm font-bold text-slate-900">{stat.value}</span>
                <span className="text-xs text-slate-400 font-medium">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 sm:py-28 bg-slate-50/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 mb-4">
              Everything you need to run HR
            </h2>
            <p className="text-slate-500 text-lg">
              From clock-in to payslip — every step is automated, verified, and beautifully simple.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Wifi,
                title: 'WiFi IP Attendance',
                description: 'Employees can only clock in when connected to the shop WiFi. No GPS spoofing, no buddy punching.',
                color: 'blue',
              },
              {
                icon: Fingerprint,
                title: 'Random Work Verification',
                description: 'Random pings are sent to clocked-in employees. Miss the 2-minute window and penalty points accumulate.',
                color: 'indigo',
              },
              {
                icon: TreePalm,
                title: 'Smart Leave Management',
                description: 'Apply for leave, track balances, and auto-skip weekends. Admins approve with one tap.',
                color: 'emerald',
              },
              {
                icon: Receipt,
                title: 'Automated Payroll',
                description: 'One click generates paysheets with automated deductions for unpaid leave and penalty points.',
                color: 'amber',
              },
              {
                icon: BarChart3,
                title: 'Reports & Analytics',
                description: 'Visual dashboards with attendance trends, leave analytics, and exportable payroll reports.',
                color: 'violet',
              },
              {
                icon: Users,
                title: 'Multi-Location Ready',
                description: 'Add unlimited shops with unique IP configurations. Scale from one store to a chain effortlessly.',
                color: 'rose',
              },
            ].map((feature, i) => {
              const colorMap: Record<string, string> = {
                blue: 'bg-blue-50 text-blue-500 border-blue-100',
                indigo: 'bg-indigo-50 text-indigo-500 border-indigo-100',
                emerald: 'bg-emerald-50 text-emerald-500 border-emerald-100',
                amber: 'bg-amber-50 text-amber-500 border-amber-100',
                violet: 'bg-violet-50 text-violet-500 border-violet-100',
                rose: 'bg-rose-50 text-rose-500 border-rose-100',
              }
              return (
                <div
                  key={i}
                  className="group p-6 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
                >
                  <div className={`inline-flex p-3 rounded-xl border ${colorMap[feature.color]} mb-4`}>
                    <feature.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">{feature.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{feature.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 mb-4">
              How it works
            </h2>
            <p className="text-slate-500 text-lg">
              Three simple steps to a fully automated HR workflow.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                step: '01',
                icon: Smartphone,
                title: 'Connect to Shop WiFi',
                description: 'Employees connect to the shop network and open the app on their phone to clock in securely.',
              },
              {
                step: '02',
                icon: Clock,
                title: 'Work is Verified Automatically',
                description: 'Random verification pings ensure active presence. Everything is logged for the admin to review.',
              },
              {
                step: '03',
                icon: Receipt,
                title: 'Payroll Runs Itself',
                description: 'At month-end, click one button. Deductions, penalties, and bonuses are calculated automatically.',
              },
            ].map((item, i) => (
              <div key={i} className="relative text-center">
                <div className="text-6xl font-black text-slate-100 mb-4">{item.step}</div>
                <div className="inline-flex p-3 rounded-xl bg-blue-50 text-blue-500 border border-blue-100 mb-4">
                  <item.icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{item.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-700 px-8 py-16 sm:px-16 sm:py-20 text-center">
            {/* Decorations */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute -top-20 -right-20 w-60 h-60 bg-white/5 rounded-full blur-2xl" />
              <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-white/5 rounded-full blur-2xl" />
            </div>

            <div className="relative">
              <h2 className="text-3xl sm:text-4xl font-black text-white mb-4 tracking-tight">
                Ready to streamline your HR?
              </h2>
              <p className="text-blue-100 text-lg max-w-xl mx-auto mb-8">
                Join the smart way to manage attendance, leave, and payroll for your phone shop chain.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-white text-blue-700 text-base font-bold hover:bg-blue-50 shadow-xl transition-all hover:-translate-y-0.5"
              >
                Sign In Now <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-8 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="relative w-7 h-7 rounded-lg overflow-hidden border border-slate-200">
              <Image src="/images/logo.jpg" alt="PhoneShop HRM" fill sizes="28px" className="object-cover" />
            </div>
            <span className="font-bold text-slate-700 text-sm">
              PhoneShop <span className="text-blue-500">HRM</span>
            </span>
          </div>
          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} PhoneShop HRM. Built for modern retail workforce management.
          </p>
        </div>
      </footer>
    </div>
  )
}
