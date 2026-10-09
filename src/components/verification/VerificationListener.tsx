'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react'

type PendingVerification = {
  id: string
  expiresAt: string
}

export function VerificationListener() {
  const [pending, setPending] = useState<PendingVerification | null>(null)
  const [timeLeft, setTimeLeft] = useState<number>(0)
  const [status, setStatus] = useState<'IDLE' | 'VERIFYING' | 'SUCCESS' | 'MISSED'>('IDLE')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    // Poll every 5 seconds for a pending verification check
    const checkVerification = async () => {
      // Don't poll if we're already handling one
      if (pending) return

      try {
        const res = await fetch('/api/verification/check')
        if (res.ok) {
          const data = await res.json()
          if (data && data.id) {
            setPending(data)
            setStatus('VERIFYING')
          }
        }
      } catch (error) {
        console.error('Failed to poll verification', error)
      }
    }

    const interval = setInterval(checkVerification, 5000)
    return () => clearInterval(interval)
  }, [pending])

  // Countdown timer logic
  useEffect(() => {
    if (!pending || status !== 'VERIFYING') return

    const tick = () => {
      const now = new Date().getTime()
      const expiry = new Date(pending.expiresAt).getTime()
      const diff = Math.max(0, Math.floor((expiry - now) / 1000))
      
      setTimeLeft(diff)
      
      if (diff === 0) {
        setStatus('MISSED')
        setTimeout(() => {
          setPending(null)
          setStatus('IDLE')
        }, 5000)
      }
    }

    tick() // Initial tick
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [pending, status])

  const handleVerify = async () => {
    if (!pending || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/verification/verify/${encodeURIComponent(pending.id)}`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setStatus('SUCCESS')
      } else if (res.status === 410) {
        setStatus('MISSED')
      } else {
        // e.g. not on shop WiFi: keep the prompt open so they can retry within the window
        setError(data.error || 'Verification failed. Please try again.')
        return
      }
    } catch {
      setError('Network error. Please try again.')
      return
    } finally {
      setSubmitting(false)
    }

    // Clear after a moment
    setTimeout(() => {
      setPending(null)
      setStatus('IDLE')
      router.refresh()
    }, 2000)
  }

  if (status === 'IDLE' || !pending) return null

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl text-center shadow-red-500/10">
        
        {status === 'VERIFYING' && (
          <>
            <div className="w-24 h-24 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
              <AlertTriangle className="w-12 h-12" />
            </div>
            
            <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Are you there?</h1>
            <p className="text-slate-500 mb-8 font-medium">
              Please confirm you are actively working by clicking the button below.
            </p>

            <div className="bg-slate-50 rounded-2xl p-6 mb-8 border border-slate-100">
              <div className="flex items-center justify-center gap-3 text-red-500 font-bold text-4xl tabular-nums">
                <Clock className="w-8 h-8" />
                {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">Time Remaining</p>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl p-3 mb-4">{error}</p>
            )}

            <button
              onClick={handleVerify}
              disabled={submitting}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xl py-5 rounded-2xl shadow-xl shadow-blue-600/30 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-60"
            >
              I AM WORKING
            </button>
          </>
        )}

        {status === 'MISSED' && (
          <>
            <div className="w-24 h-24 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-6">
              <Clock className="w-12 h-12" />
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Check Missed</h1>
            <p className="text-slate-500">You did not respond in time.</p>
          </>
        )}

        {status === 'SUCCESS' && (
          <>
            <div className="w-24 h-24 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-12 h-12" />
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Verified!</h1>
            <p className="text-slate-500">Redirecting...</p>
          </>
        )}

      </div>
    </div>
  )
}
