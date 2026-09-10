import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { addWeeks, differenceInCalendarDays, format, parseISO, startOfWeek } from 'date-fns'
import { useExams, useSettings, useSubjects, useTimetable, useWeekSessions } from '../lib/hooks'
import { useAuth } from '../lib/AuthContext'
import { generatePlan, isEntryActiveForWeek } from '../lib/planner'
import { sessionsApi } from '../lib/api'
import PlannerGrid from '../components/PlannerGrid'
import StudyTimePrompt from '../components/StudyTimePrompt'
import SessionActionModal from '../components/SessionActionModal'
import { durationLabel } from '../lib/format'
import type { DayOfWeek, StudySession } from '../types'

export default function PlannerPage() {
  const [weekOffset, setWeekOffset] = useState(0)
  const weekStartDate = useMemo(() => addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), weekOffset), [weekOffset])
  const weekStart = format(weekStartDate, 'yyyy-MM-dd')

  const { user } = useAuth()
  const { subjects } = useSubjects()
  const { entries } = useTimetable()
  const { settings, update: updateSettings } = useSettings()
  const { exams } = useExams()
  const { sessions, setSessions } = useWeekSessions(weekStart)
  const [generating, setGenerating] = useState(false)
  const [showStudyTimePrompt, setShowStudyTimePrompt] = useState(false)
  const [selectedSession, setSelectedSession] = useState<StudySession | null>(null)
  const navigate = useNavigate()

  const upcomingExams = useMemo(
    () =>
      exams
        .map((e) => ({ ...e, daysAway: differenceInCalendarDays(parseISO(e.exam_date), new Date()) }))
        .filter((e) => e.daysAway >= 0 && e.daysAway <= 21)
        .sort((a, b) => a.daysAway - b.daysAway),
    [exams]
  )

  // Only the timetable entries that actually apply this week — a "par quinzaine"
  // (every-other-week) class only shows/blocks time on weeks matching its parity.
  const entriesThisWeek = useMemo(
    () => entries.filter((e) => isEntryActiveForWeek(e, weekStartDate)),
    [entries, weekStartDate]
  )

  const handleGenerateWithTimes = async (preferredStart: number, preferredEnd: number, saveAsDefault: boolean) => {
    if (!settings || !user) return
    setShowStudyTimePrompt(false)
    setGenerating(true)
    try {
      const effectiveSettings = { ...settings, preferred_study_start_minute: preferredStart, preferred_study_end_minute: preferredEnd }
      const { sessions: planned } = generatePlan(entries, subjects, effectiveSettings, weekStartDate, exams)
      const saved = await sessionsApi.replaceAutoForWeek(user.id, weekStart, planned)
      setSessions((prev) => [...prev.filter((s) => s.source === 'manual'), ...saved])
      if (saveAsDefault) {
        await updateSettings({ preferred_study_start_minute: preferredStart, preferred_study_end_minute: preferredEnd })
      }
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

  const handleEdit = async (sessionId: string, patch: { day_of_week: DayOfWeek; start_minute: number; end_minute: number }) => {
    setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, ...patch, source: 'manual' } : s)))
    await sessionsApi.update(sessionId, { ...patch, source: 'manual' })
    setSelectedSession(null)
  }

  const handleStartStudy = (session: StudySession) => {
    const subject = subjects.find((s) => s.id === session.subject_id)
    navigate('/study', { state: { session, subject } })
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
            onClick={() => setShowStudyTimePrompt(true)}
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

      {upcomingExams.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {upcomingExams.map((e) => {
            const subject = subjects.find((s) => s.id === e.subject_id)
            return (
              <div
                key={e.id}
                className="flex items-center gap-1.5 rounded-full border border-amber-600/40 bg-amber-500/10 px-3 py-1 text-xs text-amber-300"
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: subject?.color ?? '#f59e0b' }} />
                {subject?.name ?? 'Exam'} exam {e.daysAway === 0 ? 'today' : e.daysAway === 1 ? 'tomorrow' : `in ${e.daysAway}d`}
              </div>
            )
          })}
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
          onSessionClick={setSelectedSession}
        />
      )}
      <p className="text-xs text-slate-500">
        Drag a session to reschedule it. Hover a block and tap ⋯ to study, edit, or remove it.
      </p>

      {showStudyTimePrompt && settings && (
        <StudyTimePrompt
          initialStart={settings.preferred_study_start_minute}
          initialEnd={settings.preferred_study_end_minute}
          onConfirm={handleGenerateWithTimes}
          onClose={() => setShowStudyTimePrompt(false)}
        />
      )}

      {selectedSession && (
        <SessionActionModal
          session={selectedSession}
          subject={subjects.find((s) => s.id === selectedSession.subject_id)}
          onClose={() => setSelectedSession(null)}
          onStartStudy={() => handleStartStudy(selectedSession)}
          onSaveEdit={(patch) => handleEdit(selectedSession.id, patch)}
          onToggle={() => {
            handleToggle(selectedSession.id)
            setSelectedSession(null)
          }}
          onRemove={() => {
            handleRemove(selectedSession.id)
            setSelectedSession(null)
          }}
        />
      )}
    </div>
  )
}
