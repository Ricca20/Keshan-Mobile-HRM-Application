'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { CheckCircle, XCircle, Loader2, ShieldCheck } from 'lucide-react'
import Link from 'next/link'

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'verified' }
  | { kind: 'missed'; message: string }
  | { kind: 'error'; message: string }

export default function VerifyPage() {
  const { id } = useParams<{ id: string }>()
  const [state, setState] = useState<State>({ kind: 'idle' })

  // Verification happens on an explicit click (POST), never on page load, so link
  // previews and prefetchers can't confirm a check on the employee's behalf.
  const confirm = async () => {
    setState({ kind: 'loading' })
    try {
      const res = await fetch(`/api/verification/verify/${encodeURIComponent(id)}`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (res.ok) setState({ kind: 'verified' })
      else if (res.status === 410) setState({ kind: 'missed', message: data.error })
      else setState({ kind: 'error', message: data.error || 'Verification failed.' })
    } catch {
      setState({ kind: 'error', message: 'Network error. Please try again.' })
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
        {state.kind === 'verified' ? (
          <>
            <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Work Verified!</h1>
            <p className="text-slate-600 mb-6">Your active work status has been confirmed. You can return to work.</p>
          </>
        ) : state.kind === 'missed' ? (
          <>
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Verification Missed</h1>
            <p className="text-slate-500 mb-6">You did not confirm within the required 2-minute window. Your manager has been notified.</p>
          </>
        ) : (
          <>
            <ShieldCheck className="w-16 h-16 text-blue-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Active Work Check</h1>
            <p className="text-slate-500 mb-6">Confirm you are at work. You must be connected to the shop WiFi.</p>
            {state.kind === 'error' && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3 mb-4">{state.message}</p>
            )}
            <button
              onClick={confirm}
              disabled={state.kind === 'loading'}
              className="w-full bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition disabled:opacity-60 inline-flex items-center justify-center gap-2 mb-4"
            >
              {state.kind === 'loading' && <Loader2 className="w-4 h-4 animate-spin" />}
              I AM WORKING
            </button>
          </>
        )}
        <Link href="/employee/dashboard" className="text-sm font-semibold text-blue-600 hover:underline">Return to Dashboard</Link>
      </div>
    </div>
  )
}
