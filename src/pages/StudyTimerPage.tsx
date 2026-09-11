import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { sessionsApi } from '../lib/api'
import { useAuth } from '../lib/AuthContext'
import type { StudySession, Subject } from '../types'

const ABORT_REASONS = ['Too tired', 'Got distracted', 'Ran out of time', 'Changed my mind', 'Other'] as const

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** A blunt-but-fair reaction to why the user stopped — firmer once it's a repeat pattern in the last two weeks, not a one-off. */
function verdictFor(reason: string, timesInTwoWeeks: number): string {
  const repeat = timesInTwoWeeks >= 2
  switch (reason) {
    case 'Too tired':
      return repeat
        ? `That's ${timesInTwoWeeks} sessions you've stopped from being tired in the last two weeks — this isn't bad luck, it's a scheduling mismatch. Go narrow your "productive hours" in Settings to when you're actually alert.`
        : "Fair enough, everyone has an off day. If it keeps happening, it usually means sessions are landing outside your real energy window — worth checking Settings."
    case 'Got distracted':
      return repeat
        ? `${timesInTwoWeeks} times this reason in two weeks — that's a pattern, not an accident. Phone in another room, tab closed, before you start the next one.`
        : 'Happens to everyone once. Try putting your phone out of reach for the next session.'
    case 'Ran out of time':
      return repeat
        ? `This subject has run over ${timesInTwoWeeks} times in two weeks — your sessions for it are planned too short. Raise its weekly target or difficulty so future plans give it more room.`
        : "No shame in that — might just mean this subject needs a longer block. Consider bumping its weekly target."
    case 'Changed my mind':
      return repeat
        ? `${timesInTwoWeeks} changed-mind aborts in two weeks. If this subject keeps losing out, be honest about whether it belongs in this week's plan at all, instead of aborting it each time.`
        : "Alright — just know a skipped session doesn't reschedule itself, it just doesn't happen."
    default:
      return "Thanks for being straight about it — noted."
  }
}

export default function StudyTimerPage() {
  const location = useLocation() as { state?: { session?: StudySession; subject?: Subject } }
  const navigate = useNavigate()
  const { user } = useAuth()
  const session = location.state?.session
  const subject = location.state?.subject

  const plannedSeconds = session ? (session.end_minute - session.start_minute) * 60 : 0
  const [totalSeconds, setTotalSeconds] = useState(plannedSeconds)
  const [remainingSeconds, setRemainingSeconds] = useState(plannedSeconds)
  const [running, setRunning] = useState(true)
  const [showAbortPanel, setShowAbortPanel] = useState(false)
  const [abortReason, setAbortReason] = useState<string>('')
  const [customReason, setCustomReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [verdict, setVerdict] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!running) return
    intervalRef.current = setInterval(() => {
      setRemainingSeconds((r) => Math.max(0, r - 1))
    }, 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [running])

  useEffect(() => {
    if (remainingSeconds === 0) setRunning(false)
  }, [remainingSeconds])

  const finish = useCallback(async () => {
    if (!session || saving) return
    setSaving(true)
    const elapsedMinutes = Math.max(1, Math.round((totalSeconds - remainingSeconds) / 60))
    const actualEnd = session.start_minute + elapsedMinutes
    await sessionsApi.finishEarly(session.id, actualEnd)
    navigate('/', { replace: true })
  }, [session, saving, totalSeconds, remainingSeconds, navigate])

  const confirmAbort = async () => {
    if (!session || !user) return
    const reason = abortReason === 'Other' ? customReason.trim() : abortReason
    if (!reason) return
    setSaving(true)
    await sessionsApi.abort(session.id, reason)
    const sinceIso = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
    const timesInTwoWeeks = await sessionsApi.countRecentAbortsByReason(user.id, reason, sinceIso).catch(() => 1)
    setSaving(false)
    setVerdict(verdictFor(reason, timesInTwoWeeks))
  }

  if (!session || !subject) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-950 px-4 text-center">
        <p className="text-sm text-slate-400">This session isn't available — it may have been opened from a refreshed page.</p>
        <button
          onClick={() => navigate('/')}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500"
        >
          Back to Planner
        </button>
      </div>
    )
  }

  if (verdict) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center px-4 py-10 text-center"
        style={{ background: `radial-gradient(circle at 50% 35%, ${subject.color}22 0%, #020617 70%)` }}
      >
        <p className="mb-2 text-xs uppercase tracking-widest text-slate-500">Session stopped</p>
        <h1 className="mb-4 text-xl font-semibold text-white">{subject.name}</h1>
        <p className="mb-8 max-w-sm text-sm leading-relaxed text-slate-300">{verdict}</p>
        <button
          onClick={() => navigate('/', { replace: true })}
          className="rounded-full bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-500"
        >
          Back to Planner
        </button>
      </div>
    )
  }

  const fraction = totalSeconds > 0 ? remainingSeconds / totalSeconds : 0
  const radius = 120
  const circumference = 2 * Math.PI * radius
  const dashoffset = circumference * (1 - fraction)
  const color = subject.color

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-4 py-10 text-center"
      style={{
        background: `radial-gradient(circle at 50% 35%, ${color}22 0%, #020617 70%)`,
      }}
    >
      <button
        onClick={() => navigate('/')}
        className="absolute left-4 top-4 rounded-lg px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-900 hover:text-slate-300"
      >
        ← Leave
      </button>

      <p className="mb-1 text-xs uppercase tracking-widest text-slate-500">Focus session</p>
      <h1 className="mb-8 text-2xl font-semibold text-white">{subject.name}</h1>

      <div className="relative mb-10 flex h-72 w-72 items-center justify-center">
        <div
          className="absolute inset-0 rounded-full blur-2xl"
          style={{ backgroundColor: `${color}18`, animation: running ? 'ftm-pulse 4s ease-in-out infinite' : undefined }}
        />
        <svg width="256" height="256" viewBox="0 0 256 256" className="absolute -rotate-90">
          <circle cx="128" cy="128" r={radius} fill="none" stroke="#1e293b" strokeWidth="10" />
          <circle
            cx="128"
            cy="128"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashoffset}
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        </svg>
        <div className="relative">
          <div className="font-mono text-5xl font-semibold text-white tabular-nums">{formatClock(remainingSeconds)}</div>
          {remainingSeconds === 0 && <div className="mt-1 text-xs text-slate-400">Time's up — nice work</div>}
        </div>
      </div>

      {!showAbortPanel ? (
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setRunning((r) => !r)}
              disabled={remainingSeconds === 0}
              className="rounded-full border border-slate-700 px-5 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-40"
            >
              {running ? '⏸ Pause' : '▶ Resume'}
            </button>
            <button
              onClick={() => {
                setTotalSeconds((t) => t + 600)
                setRemainingSeconds((r) => r + 600)
              }}
              className="rounded-full border border-slate-700 px-5 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-800"
            >
              +10 min
            </button>
            <button
              onClick={finish}
              disabled={saving}
              className="rounded-full bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
            >
              ✓ Done
            </button>
          </div>
          <button
            onClick={() => setShowAbortPanel(true)}
            className="text-xs text-slate-500 underline decoration-dotted hover:text-slate-300"
          >
            Stop early
          </button>
        </div>
      ) : (
        <div className="w-full max-w-xs rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <p className="mb-3 text-sm font-medium text-white">Why are you stopping?</p>
          <div className="mb-3 space-y-1.5 text-left">
            {ABORT_REASONS.map((r) => (
              <label key={r} className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="radio"
                  name="abort-reason"
                  checked={abortReason === r}
                  onChange={() => setAbortReason(r)}
                  className="accent-brand-600"
                />
                {r}
              </label>
            ))}
          </div>
          {abortReason === 'Other' && (
            <input
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="Say a bit more…"
              className="mb-3 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white outline-none"
            />
          )}
          <div className="flex gap-2">
            <button
              onClick={confirmAbort}
              disabled={!abortReason || (abortReason === 'Other' && !customReason.trim()) || saving}
              className="flex-1 rounded-lg bg-red-600/90 py-2 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-40"
            >
              {saving ? 'Stopping…' : 'Confirm stop'}
            </button>
            <button
              onClick={() => setShowAbortPanel(false)}
              className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
            >
              Never mind
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes ftm-pulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.06); }
        }
      `}</style>
    </div>
  )
}
