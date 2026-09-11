import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { addWeeks, differenceInCalendarDays, format, parseISO, startOfWeek } from 'date-fns'
import { useAssignments, useExams, useSettings, useSubjects, useTimetable, useWeekSessions } from '../lib/hooks'
import { useAuth } from '../lib/AuthContext'
import { findCatchUpSlot, generatePlan, isEntryActiveForWeek } from '../lib/planner'
import { sessionsApi } from '../lib/api'
import PlannerGrid from '../components/PlannerGrid'
import StudyTimePrompt from '../components/StudyTimePrompt'
import SessionActionModal from '../components/SessionActionModal'
import { durationLabel, minutesToLabel } from '../lib/format'
import { DAY_LABELS, type DayOfWeek, type StudySession } from '../types'

export default function PlannerPage() {
  const [weekOffset, setWeekOffset] = useState(0)
  const weekStartDate = useMemo(() => addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), weekOffset), [weekOffset])
  const weekStart = format(weekStartDate, 'yyyy-MM-dd')

  const { user } = useAuth()
  const { subjects } = useSubjects()
  const { entries } = useTimetable()
  const { settings, update: updateSettings } = useSettings()
  const { exams } = useExams()
  const { assignments } = useAssignments()
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

  const upcomingAssignments = useMemo(
    () =>
      assignments
        .map((a) => ({ ...a, daysAway: differenceInCalendarDays(parseISO(a.due_date), new Date()) }))
        .filter((a) => a.daysAway >= 0 && a.daysAway <= 21)
        .sort((a, b) => a.daysAway - b.daysAway),
    [assignments]
  )

  // Subjects whose completed-so-far share of this week's planned time is meaningfully behind
  // how much of the week has already elapsed — a proactive nudge instead of an after-the-fact stat.
  const behindSubjects = useMemo(() => {
    if (weekOffset !== 0) return []
    const now = new Date()
    const dayIndexMon0 = (now.getDay() + 6) % 7 // 0=Mon..6=Sun
    const elapsedFraction = (dayIndexMon0 + (now.getHours() * 60 + now.getMinutes()) / 1440) / 7
    if (elapsedFraction < 0.15) return []

    return subjects
      .map((s) => {
        const subjSessions = sessions.filter((sess) => sess.subject_id === s.id)
        const target = subjSessions.reduce((sum, sess) => sum + (sess.end_minute - sess.start_minute), 0)
        const done = subjSessions
          .filter((sess) => sess.status === 'completed')
          .reduce((sum, sess) => sum + (sess.end_minute - sess.start_minute), 0)
        return { id: s.id, name: s.name, target, doneShare: target > 0 ? done / target : 1 }
      })
      .filter((s) => s.target > 0 && elapsedFraction - s.doneShare >= 0.25)
      .map((s) => ({ ...s, donePct: Math.round(s.doneShare * 100), elapsedPct: Math.round(elapsedFraction * 100) }))
  }, [weekOffset, subjects, sessions])

  // A skipped session's lost time, with a suggested slot to make it up this week — if one exists.
  const catchUpSuggestions = useMemo(() => {
    if (!settings) return []
    return sessions
      .filter((s) => s.status === 'skipped' && !s.catch_up_dismissed)
      .map((s) => {
        const minutesNeeded = s.end_minute - s.start_minute
        const slot = findCatchUpSlot(entries, sessions, settings, weekStartDate, minutesNeeded)
        return { session: s, slot }
      })
      .filter((c) => c.slot !== null)
  }, [sessions, entries, settings, weekStartDate])

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
      const { sessions: planned } = generatePlan(entries, subjects, effectiveSettings, weekStartDate, exams, assignments)
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

  const handleAcceptCatchUp = async (session: StudySession, slot: { day_of_week: DayOfWeek; start_minute: number; end_minute: number }) => {
    if (!user) return
    const created = await sessionsApi.create(user.id, { subject_id: session.subject_id, ...slot, week_start: weekStart })
    const updated = await sessionsApi.update(session.id, { catch_up_dismissed: true })
    setSessions((prev) => [...prev.map((s) => (s.id === session.id ? updated : s)), created])
  }

  const handleDismissCatchUp = async (session: StudySession) => {
    const updated = await sessionsApi.update(session.id, { catch_up_dismissed: true })
    setSessions((prev) => prev.map((s) => (s.id === session.id ? updated : s)))
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

      {(upcomingExams.length > 0 || upcomingAssignments.length > 0) && (
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
          {upcomingAssignments.map((a) => {
            const subject = subjects.find((s) => s.id === a.subject_id)
            return (
              <div
                key={a.id}
                className="flex items-center gap-1.5 rounded-full border border-sky-600/40 bg-sky-500/10 px-3 py-1 text-xs text-sky-300"
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: subject?.color ?? '#38bdf8' }} />
                {a.title} due {a.daysAway === 0 ? 'today' : a.daysAway === 1 ? 'tomorrow' : `in ${a.daysAway}d`}
              </div>
            )
          })}
        </div>
      )}

      {behindSubjects.length > 0 && (
        <div className="space-y-1.5">
          {behindSubjects.map((s) => (
            <p
              key={s.id}
              className="rounded-lg border border-orange-600/40 bg-orange-500/10 px-3 py-2 text-xs text-orange-300"
            >
              You're behind on <strong>{s.name}</strong> — {s.donePct}% done with {s.elapsedPct}% of the week gone.
            </p>
          ))}
        </div>
      )}

      {catchUpSuggestions.length > 0 && (
        <div className="space-y-1.5">
          {catchUpSuggestions.map(({ session, slot }) => {
            const subject = subjects.find((s) => s.id === session.subject_id)
            if (!slot) return null
            return (
              <div
                key={session.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sky-600/40 bg-sky-500/10 px-3 py-2 text-xs text-sky-300"
              >
                <span>
                  Catch up {durationLabel(0, session.end_minute - session.start_minute)} of missed{' '}
                  <strong>{subject?.name ?? 'study'}</strong> time — free on{' '}
                  {DAY_LABELS[slot.day_of_week]} at {minutesToLabel(slot.start_minute)}
                </span>
                <span className="flex gap-1.5">
                  <button
                    onClick={() => handleAcceptCatchUp(session, slot)}
                    className="rounded-md bg-sky-600/90 px-2 py-1 font-semibold text-white hover:bg-sky-600"
                  >
                    Add session
                  </button>
                  <button
                    onClick={() => handleDismissCatchUp(session)}
                    className="rounded-md px-2 py-1 font-medium text-slate-400 hover:bg-slate-800"
                  >
                    Dismiss
                  </button>
                </span>
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
