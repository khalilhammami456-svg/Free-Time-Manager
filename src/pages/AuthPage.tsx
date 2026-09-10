import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { isSupabaseConfigured } from '../lib/supabase'

export default function AuthPage() {
  const { user, signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to="/" replace />

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setSubmitting(true)
    try {
      if (mode === 'signin') {
        const { error } = await signIn(email, password)
        if (error) setError(error)
      } else {
        const { error } = await signUp(email, password, fullName)
        if (error) setError(error)
        else setInfo('Account created! Check your email to confirm, then sign in.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-2xl">
            ⏱️
          </div>
          <h1 className="text-2xl font-semibold text-white">Free Time Manager</h1>
          <p className="mt-1 text-sm text-slate-400">Turn your timetable into a smart study plan.</p>
        </div>

        {!isSupabaseConfigured && (
          <div className="mb-4 rounded-lg border border-amber-600/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
            Supabase isn't configured yet. Copy <code>.env.example</code> to <code>.env.local</code> and add your
            project URL/anon key to enable sign in.
          </div>
        )}

        <div className="mb-6 flex rounded-lg bg-slate-900 p-1">
          <button
            type="button"
            onClick={() => setMode('signin')}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition ${mode === 'signin' ? 'bg-brand-600 text-white' : 'text-slate-400'}`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setMode('signup')}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition ${mode === 'signup' ? 'bg-brand-600 text-white' : 'text-slate-400'}`}
          >
            Sign up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Full name</label>
              <input
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-brand-500"
                placeholder="Jane Doe"
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Email</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-brand-500"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Password</label>
            <input
              required
              type="password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-brand-500"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}
          {info && <p className="text-xs text-emerald-400">{info}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-500 disabled:opacity-50"
          >
            {submitting ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  )
}
