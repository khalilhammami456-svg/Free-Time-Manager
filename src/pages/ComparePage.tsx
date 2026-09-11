import { useMemo, useState } from 'react'
import { addWeeks, startOfWeek } from 'date-fns'
import { useProfile, useSettings, useTimetable } from '../lib/hooks'
import { profilesApi } from '../lib/api'
import { computeFreeSlots, isEntryActiveForWeek } from '../lib/planner'
import { minutesToLabel } from '../lib/format'
import { DAY_LABELS, type SharedBusyBlock } from '../types'

export default function ComparePage() {
  const { profile, update: updateProfile } = useProfile()
  const { entries } = useTimetable()
  const { settings } = useSettings()

  const [code, setCode] = useState('')
  const [busyBlocks, setBusyBlocks] = useState<SharedBusyBlock[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const weekStart = useMemo(() => addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), 0), [])

  const handleFind = async () => {
    if (!code.trim()) return
    setError(null)
    setBusyBlocks(null)
    setLoading(true)
    try {
      const rows = await profilesApi.getSharedBusyBlocks(code)
      if (rows.length === 0) {
        setError("No sharing profile found for that code — check it's correct, or ask them to enable sharing first.")
      }
      setBusyBlocks(rows)
    } catch {
      setError('Something went wrong looking that up. Double-check the code and try again.')
    } finally {
      setLoading(false)
    }
  }

  const mutualFreeByDay = useMemo(() => {
    if (!settings || !busyBlocks) return null
    const activeEntries = entries.filter((e) => isEntryActiveForWeek(e, weekStart))
    const mutual = computeFreeSlots(activeEntries, settings, weekStart, busyBlocks)
    const byDay = new Map<number, typeof mutual>()
    for (const slot of mutual) {
      if (!byDay.has(slot.day_of_week)) byDay.set(slot.day_of_week, [])
      byDay.get(slot.day_of_week)!.push(slot)
    }
    return byDay
  }, [settings, entries, busyBlocks, weekStart])

  const copyCode = async () => {
    if (!profile) return
    await navigator.clipboard.writeText(profile.share_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="max-w-lg space-y-8">
      <header>
        <h1 className="text-xl font-semibold text-white">Compare free time</h1>
        <p className="mt-1 text-sm text-slate-400">
          Find windows this week when you and a classmate are both free — handy for group study.
          Only bare busy/free times are ever shared, never subjects, sessions, or any other data.
        </p>
      </header>

      <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Your sharing</h2>
            <p className="text-xs text-slate-400">Turn this on so classmates can compare their free time with yours.</p>
          </div>
          <input
            type="checkbox"
            checked={profile?.sharing_enabled ?? false}
            onChange={(e) => updateProfile({ sharing_enabled: e.target.checked })}
            className="h-5 w-5 accent-brand-600"
          />
        </div>
        {profile?.sharing_enabled && profile.share_code && (
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white">
              {profile.share_code}
            </code>
            <button
              onClick={copyCode}
              className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
            >
              {copied ? 'Copied ✓' : 'Copy'}
            </button>
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <h2 className="text-sm font-semibold text-white">Compare with a classmate</h2>
        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter their share code"
            className="flex-1 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-brand-500"
          />
          <button
            onClick={handleFind}
            disabled={loading || !code.trim()}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
          >
            {loading ? 'Looking…' : 'Find overlap'}
          </button>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </section>

      {mutualFreeByDay && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-white">Mutual free time this week</h2>
          {mutualFreeByDay.size === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-800 p-6 text-center text-sm text-slate-500">
              No overlapping free windows this week.
            </p>
          ) : (
            <ul className="space-y-2">
              {Array.from(mutualFreeByDay.entries())
                .sort((a, b) => a[0] - b[0])
                .map(([day, slots]) => (
                  <li key={day} className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3">
                    <div className="mb-1 text-xs font-semibold text-slate-300">{DAY_LABELS[day]}</div>
                    <div className="flex flex-wrap gap-2">
                      {slots.map((s, i) => (
                        <span key={i} className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300">
                          {minutesToLabel(s.start_minute)}–{minutesToLabel(s.end_minute)}
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
