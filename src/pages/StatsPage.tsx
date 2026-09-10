import { useEffect, useMemo, useState } from 'react'
import { addDays, format, parseISO, startOfWeek, subWeeks } from 'date-fns'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useAuth } from '../lib/AuthContext'
import { useSubjects } from '../lib/hooks'
import { sessionsApi } from '../lib/api'
import type { StudySession } from '../types'
import { durationLabel } from '../lib/format'

const WEEKS_BACK = 8

function resolveSessionDate(session: StudySession): Date {
  const monday = parseISO(session.week_start)
  const offsetFromMonday = (session.day_of_week + 6) % 7 // Mon=0 .. Sun=6
  return addDays(monday, offsetFromMonday)
}

export default function StatsPage() {
  const { user } = useAuth()
  const { subjects } = useSubjects()
  const [sessions, setSessions] = useState<StudySession[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const toWeekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
    const fromWeekStart = format(subWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), WEEKS_BACK - 1), 'yyyy-MM-dd')
    setLoading(true)
    sessionsApi
      .listInRange(user.id, fromWeekStart, toWeekStart)
      .then(setSessions)
      .finally(() => setLoading(false))
  }, [user])

  const bySubject = useMemo(() => {
    return subjects
      .map((s) => {
        const completedMinutes = sessions
          .filter((sess) => sess.subject_id === s.id && sess.status === 'completed')
          .reduce((sum, sess) => sum + (sess.end_minute - sess.start_minute), 0)
        return { id: s.id, name: s.name, color: s.color, minutes: completedMinutes }
      })
      .filter((s) => s.minutes > 0)
      .sort((a, b) => b.minutes - a.minutes)
  }, [subjects, sessions])

  const byWeek = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of sessions) {
      if (s.status !== 'completed') continue
      map.set(s.week_start, (map.get(s.week_start) ?? 0) + (s.end_minute - s.start_minute))
    }
    const weeks: { week: string; label: string; minutes: number }[] = []
    for (let i = WEEKS_BACK - 1; i >= 0; i--) {
      const weekStart = format(subWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), i), 'yyyy-MM-dd')
      weeks.push({ week: weekStart, label: format(parseISO(weekStart), 'MMM d'), minutes: map.get(weekStart) ?? 0 })
    }
    return weeks
  }, [sessions])

  const adherence = useMemo(() => {
    const decided = sessions.filter((s) => s.status === 'completed' || s.status === 'skipped')
    if (decided.length === 0) return null
    const completed = decided.filter((s) => s.status === 'completed').length
    return Math.round((completed / decided.length) * 100)
  }, [sessions])

  const streak = useMemo(() => {
    const completedDates = new Set(
      sessions.filter((s) => s.status === 'completed').map((s) => format(resolveSessionDate(s), 'yyyy-MM-dd'))
    )
    let count = 0
    let cursor = new Date()
    if (!completedDates.has(format(cursor, 'yyyy-MM-dd'))) cursor = addDays(cursor, -1)
    while (completedDates.has(format(cursor, 'yyyy-MM-dd'))) {
      count++
      cursor = addDays(cursor, -1)
    }
    return count
  }, [sessions])

  const totalCompletedMinutes = bySubject.reduce((sum, s) => sum + s.minutes, 0)

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-xl font-semibold text-white">Progress</h1>
        <p className="mt-1 text-sm text-slate-400">Last {WEEKS_BACK} weeks of study activity.</p>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Total studied" value={durationLabel(0, totalCompletedMinutes)} />
        <StatTile label="Day streak" value={`${streak} 🔥`} />
        <StatTile label="Adherence" value={adherence === null ? '—' : `${adherence}%`} />
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <>
          <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="mb-4 text-sm font-semibold text-white">Minutes studied per subject</h2>
            {bySubject.length === 0 ? (
              <p className="text-xs text-slate-500">No completed sessions yet — mark sessions done in the planner.</p>
            ) : (
              <div style={{ width: '100%', height: Math.max(bySubject.length * 40, 120) }}>
                <ResponsiveContainer>
                  <BarChart data={bySubject} layout="vertical" margin={{ left: 8, right: 24 }}>
                    <CartesianGrid horizontal={false} stroke="#1e293b" />
                    <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#334155' }} tickLine={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={100}
                      tick={{ fill: '#cbd5e1', fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(148,163,184,0.08)' }}
                      contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }}
                      formatter={(value) => [durationLabel(0, Number(value)), 'Studied']}
                    />
                    <Bar dataKey="minutes" radius={[0, 4, 4, 0]}>
                      {bySubject.map((s) => (
                        <Cell key={s.id} fill={s.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="mb-4 text-sm font-semibold text-white">Weekly study time</h2>
            <div style={{ width: '100%', height: 200 }}>
              <ResponsiveContainer>
                <BarChart data={byWeek} margin={{ left: -20 }}>
                  <CartesianGrid vertical={false} stroke="#1e293b" />
                  <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#334155' }} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: 'rgba(148,163,184,0.08)' }}
                    contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }}
                    formatter={(value) => [durationLabel(0, Number(value)), 'Studied']}
                  />
                  <Bar dataKey="minutes" fill="#3987e5" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-center">
      <div className="text-lg font-semibold text-white">{value}</div>
      <div className="mt-0.5 text-[11px] text-slate-500">{label}</div>
    </div>
  )
}
