import { useMemo, useState } from 'react'
import { addWeeks, format, startOfWeek } from 'date-fns'
import { useSettings, useSubjects, useTimetable, useWeekSessions } from '../lib/hooks'
import { useAuth } from '../lib/AuthContext'
import { generatePlan, isEntryActiveForWeek } from '../lib/planner'
import { sessionsApi } from '../lib/api'
import PlannerGrid from '../components/PlannerGrid'
import { durationLabel } from '../lib/format'
import type { DayOfWeek } from '../types'

export default function PlannerPage() {
  const [weekOffset, setWeekOffset] = useState(0)
  const weekStartDate = useMemo(() => addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), weekOffset), [weekOffset])
  const weekStart = format(weekStartDate, 'yyyy-MM-dd')

  const { user } = useAuth()
  const { subjects } = useSubjects()
  const { entries } = useTimetable()
  const { settings } = useSettings()
  const { sessions, setSessions } = useWeekSessions(weekStart)
  const [generating, setGenerating] = useState(false)

  // Only the timetable entries that actually apply this week — a "par quinzaine"
  // (every-other-week) class only shows/blocks time on weeks matching its parity.
  const entriesThisWeek = useMemo(
    () => entries.filter((e) => isEntryActiveForWeek(e, weekStartDate)),
    [entries, weekStartDate]
  )

  const handleGenerate = async () => {
    if (!settings || !user) return
    setGenerating(true)
    try {
      const { sessions: planned } = generatePlan(entries, subjects, settings, weekStartDate)
      const saved = await sessionsApi.replaceAutoForWeek(user.id, weekStart, planned)
      setSessions((prev) => [...prev.filter((s) => s.source === 'manual'), ...saved])
    } finally {
      setGenerating(false)
    }
  }

  const handleMove = async (sessionId: string, day: DayOfWeek, startMinute: number) => {
    const session = sessions.find((s) => s.id === sessionId)
    if (!session) return
    const duration = session.end_minute - session.start_minute
    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId
          ? { ...s, day_of_week: day, start_minute: startMinute, end_minute: startMinute + duration, source: 'manual' }
          : s
      )
    )
    await sessionsApi.update(sessionId, {
      day_of_week: day,
      start_minute: startMinute,
      end_minute: startMinute + duration,
      source: 'manual',
    })
  }

  const handleToggle = async (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId)
    if (!session) return
    const nextStatus = session.status === 'completed' ? 'planned' : 'completed'
    setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, status: nextStatus } : s)))
    await sessionsApi.setStatus(sessionId, nextStatus)
  }

  const handleRemove = async (sessionId: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== sessionId))
    await sessionsApi.remove(sessionId)
  }

  const totalsBySubject = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of sessions) {
      map.set(s.subject_id, (map.get(s.subject_id) ?? 0) + (s.end_minute - s.start_minute))
    }
    return map
  }, [sessions])

  const totalMinutes = sessions.reduce((sum, s) => sum + (s.end_minute - s.start_minute), 0)

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Weekly Planner</h1>
          <p className="mt-1 text-sm text-slate-400">
            Week of {format(weekStartDate, 'MMM d, yyyy')} · {durationLabel(0, totalMinutes)} of study planned
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekOffset((w) => w - 1)}
            className="rounded-lg border border-slate-800 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
          >
            ← Prev
          </button>
          <button
            onClick={() => setWeekOffset(0)}
            className="rounded-lg border border-slate-800 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
          >
            This week
          </button>
          <button
            onClick={() => setWeekOffset((w) => w + 1)}
            className="rounded-lg border border-slate-800 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
          >
            Next →
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating || subjects.length === 0}
            className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
          >
            {generating ? 'Generating…' : '✨ Generate plan'}
          </button>
        </div>
      </header>

      {subjects.length === 0 && (
        <p className="rounded-lg border border-amber-600/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          Add subjects with a difficulty rating first — the planner needs them to know how to split your free time.
        </p>
      )}

      {subjects.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {subjects.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900/60 px-3 py-1 text-xs text-slate-300"
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
              {s.name} · {durationLabel(0, totalsBySubject.get(s.id) ?? 0)}
            </div>
          ))}
        </div>
      )}

      {settings && (
        <PlannerGrid
          dayStartMinute={settings.day_start_minute}
          dayEndMinute={settings.day_end_minute}
          timetable={entriesThisWeek}
          sessions={sessions}
          subjects={subjects}
          onSessionMove={handleMove}
          onSessionToggle={handleToggle}
          onSessionRemove={handleRemove}
        />
      )}
      <p className="text-xs text-slate-500">
        Drag a session to reschedule it. Hover a block for options to mark it done or remove it.
      </p>
    </div>
  )
}
