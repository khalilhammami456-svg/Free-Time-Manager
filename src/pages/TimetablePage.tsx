import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { startOfWeek } from 'date-fns'
import { useSettings, useSubjects, useTimetable } from '../lib/hooks'
import type { ParsedTimetableRow } from '../lib/ocr'
import { getWeekParity } from '../lib/planner'
import { minutesToTimeInput, timeInputToMinutes } from '../lib/format'
import WeekGrid from '../components/WeekGrid'
import { DAY_LABELS, type DayOfWeek, type Recurrence } from '../types'

const THIS_WEEK_PARITY = getWeekParity(startOfWeek(new Date(), { weekStartsOn: 1 }))
const OTHER_WEEK_PARITY: Recurrence = THIS_WEEK_PARITY === 'odd_weeks' ? 'even_weeks' : 'odd_weeks'

const RECURRENCE_LABELS: Record<Recurrence, string> = {
  weekly: 'Every week',
  odd_weeks: THIS_WEEK_PARITY === 'odd_weeks' ? 'This week, then every 2 weeks' : 'Next week, then every 2 weeks',
  even_weeks: THIS_WEEK_PARITY === 'even_weeks' ? 'This week, then every 2 weeks' : 'Next week, then every 2 weeks',
}

function RecurrenceSelect({
  value,
  onChange,
  className,
}: {
  value: Recurrence
  onChange: (r: Recurrence) => void
  className?: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as Recurrence)}
      className={className ?? 'rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none'}
    >
      <option value="weekly">{RECURRENCE_LABELS.weekly}</option>
      <option value={THIS_WEEK_PARITY}>{RECURRENCE_LABELS[THIS_WEEK_PARITY]}</option>
      <option value={OTHER_WEEK_PARITY}>{RECURRENCE_LABELS[OTHER_WEEK_PARITY]}</option>
    </select>
  )
}

type OcrRow = ParsedTimetableRow & { include: boolean; recurrence: Recurrence }

export default function TimetablePage() {
  const { entries, create, createMany, update, remove } = useTimetable()
  const { subjects } = useSubjects()
  const { settings } = useSettings()

  const [title, setTitle] = useState('')
  const [day, setDay] = useState<DayOfWeek>(1)
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('10:00')
  const [subjectId, setSubjectId] = useState('')
  const [recurrence, setRecurrence] = useState<Recurrence>('weekly')

  const [ocrStatus, setOcrStatus] = useState<string | null>(null)
  const [ocrProgress, setOcrProgress] = useState(0)
  const [ocrRows, setOcrRows] = useState<OcrRow[] | null>(null)
  const [ocrError, setOcrError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    const start_minute = timeInputToMinutes(start)
    const end_minute = timeInputToMinutes(end)
    if (end_minute <= start_minute) return
    await create({
      title: title.trim(),
      day_of_week: day,
      start_minute,
      end_minute,
      subject_id: subjectId || null,
      recurrence,
    })
    setTitle('')
    setRecurrence('weekly')
  }

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setOcrError(null)
    setOcrRows(null)
    setOcrStatus('loading scanner')
    setOcrProgress(0)
    try {
      const { extractTimetableFromFile } = await import('../lib/ocr')
      const { rows } = await extractTimetableFromFile(file, (status, progress) => {
        setOcrStatus(status)
        setOcrProgress(progress)
      })
      if (rows.length === 0) {
        setOcrError("Couldn't detect any class times in that file. Try a clearer photo, or add entries manually below.")
      }
      // For a detected biweekly pair, pre-suggest alternating weeks (first occurrence gets
      // "this week", the second gets "next week") so the picker below just needs confirming.
      const seenPairs = new Set<string>()
      setOcrRows(
        rows.map((r) => {
          let suggested: Recurrence = 'weekly'
          if (r.possiblyBiweekly && r.biweeklyPairKey) {
            suggested = seenPairs.has(r.biweeklyPairKey) ? OTHER_WEEK_PARITY : THIS_WEEK_PARITY
            seenPairs.add(r.biweeklyPairKey)
          }
          return { ...r, include: true, recurrence: suggested }
        })
      )
    } catch (err) {
      setOcrError(err instanceof Error ? err.message : 'Failed to scan the file.')
    } finally {
      setOcrStatus(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const updateOcrRow = (index: number, patch: Partial<OcrRow>) => {
    setOcrRows((prev) => (prev ? prev.map((r, i) => (i === index ? { ...r, ...patch } : r)) : prev))
  }

  const saveOcrRows = async () => {
    if (!ocrRows) return
    const toSave = ocrRows.filter((r) => r.include && r.day !== null && r.start_minute !== null && r.end_minute !== null)
    if (toSave.length === 0) return
    await createMany(
      toSave.map((r) => ({
        title: r.title || 'Class',
        subject_id: null,
        day_of_week: r.day as DayOfWeek,
        start_minute: r.start_minute as number,
        end_minute: r.end_minute as number,
        recurrence: r.recurrence,
        source: 'ocr' as const,
      }))
    )
    setOcrRows(null)
  }

  const biweeklyRowCount = ocrRows?.filter((r) => r.possiblyBiweekly).length ?? 0

  const blocks = entries.map((e) => {
    const subject = subjects.find((s) => s.id === e.subject_id)
    return {
      id: e.id,
      day_of_week: e.day_of_week,
      start_minute: e.start_minute,
      end_minute: e.end_minute,
      color: subject?.color ?? '#475569',
      label: e.title,
      sublabel: e.recurrence !== 'weekly' ? RECURRENCE_LABELS[e.recurrence] : undefined,
      onClick: () => {
        if (confirm(`Remove "${e.title}"?`)) remove(e.id)
      },
    }
  })

  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => a.day_of_week - b.day_of_week || a.start_minute - b.start_minute),
    [entries]
  )

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-xl font-semibold text-white">Timetable</h1>
        <p className="mt-1 text-sm text-slate-400">
          Add your classes, work shifts, or other commitments — everything else becomes free time.
        </p>
      </header>

      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <h2 className="mb-3 text-sm font-semibold text-white">Scan a timetable (photo or PDF)</h2>
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            onChange={handleFile}
            className="text-xs text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-600 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-brand-500"
          />
          {ocrStatus && (
            <span className="text-xs text-slate-400">
              {ocrStatus}… {Math.round(ocrProgress * 100)}%
            </span>
          )}
        </div>
        {ocrError && <p className="mt-2 text-xs text-red-400">{ocrError}</p>}

        {ocrRows && ocrRows.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs text-slate-400">
              Review what we detected and fix anything that's wrong before saving.
            </p>
            {biweeklyRowCount > 0 && (
              <p className="rounded-lg border border-amber-600/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                We found {biweeklyRowCount} classes (highlighted below) sharing the exact same time slot as another
                class — that usually means they only meet <strong>every other week</strong>. We've guessed which
                week each one is; double-check the "Repeats" column and fix it if it's wrong.
              </p>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-xs">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="w-8 py-1"></th>
                    <th className="py-1 pr-2">Day</th>
                    <th className="py-1 pr-2">Start</th>
                    <th className="py-1 pr-2">End</th>
                    <th className="py-1 pr-2">Title</th>
                    <th className="py-1 pr-2">Repeats</th>
                  </tr>
                </thead>
                <tbody>
                  {ocrRows.map((row, i) => (
                    <tr key={i} className={`border-t border-slate-800 ${row.possiblyBiweekly ? 'bg-amber-500/5' : ''}`}>
                      <td className="py-1">
                        <input
                          type="checkbox"
                          checked={row.include}
                          onChange={(e) => updateOcrRow(i, { include: e.target.checked })}
                        />
                      </td>
                      <td className="py-1 pr-2">
                        <select
                          value={row.day ?? ''}
                          onChange={(e) => updateOcrRow(i, { day: e.target.value === '' ? null : (Number(e.target.value) as DayOfWeek) })}
                          className="rounded border border-slate-800 bg-slate-950 px-1 py-0.5 text-white"
                        >
                          <option value="">—</option>
                          {DAY_LABELS.map((label, d) => (
                            <option key={d} value={d}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-1 pr-2">
                        <input
                          type="time"
                          value={row.start_minute !== null ? minutesToTimeInput(row.start_minute) : ''}
                          onChange={(e) => updateOcrRow(i, { start_minute: timeInputToMinutes(e.target.value) })}
                          className="rounded border border-slate-800 bg-slate-950 px-1 py-0.5 text-white"
                        />
                      </td>
                      <td className="py-1 pr-2">
                        <input
                          type="time"
                          value={row.end_minute !== null ? minutesToTimeInput(row.end_minute) : ''}
                          onChange={(e) => updateOcrRow(i, { end_minute: timeInputToMinutes(e.target.value) })}
                          className="rounded border border-slate-800 bg-slate-950 px-1 py-0.5 text-white"
                        />
                      </td>
                      <td className="py-1 pr-2">
                        <input
                          value={row.title}
                          onChange={(e) => updateOcrRow(i, { title: e.target.value })}
                          className="w-full min-w-[220px] rounded border border-slate-800 bg-slate-950 px-1 py-0.5 text-white"
                        />
                      </td>
                      <td className="py-1 pr-2">
                        <RecurrenceSelect
                          value={row.recurrence}
                          onChange={(r) => updateOcrRow(i, { recurrence: r })}
                          className="rounded border border-slate-800 bg-slate-950 px-1 py-0.5 text-white"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={saveOcrRows}
                className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-500"
              >
                Add selected to timetable
              </button>
              <button
                onClick={() => setOcrRows(null)}
                className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800"
              >
                Discard
              </button>
            </div>
          </div>
        )}
      </section>

      <form onSubmit={handleAdd} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <h2 className="mb-3 text-sm font-semibold text-white">Add manually</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[140px] flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-400">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Physics lecture"
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-brand-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Day</label>
            <select
              value={day}
              onChange={(e) => setDay(Number(e.target.value) as DayOfWeek)}
              className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
            >
              {DAY_LABELS.map((label, d) => (
                <option key={d} value={d}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Start</label>
            <input
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">End</label>
            <input
              type="time"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Subject (optional)</label>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
            >
              <option value="">None</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Repeats</label>
            <RecurrenceSelect value={recurrence} onChange={setRecurrence} />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500"
          >
            Add
          </button>
        </div>
      </form>

      {settings && (
        <WeekGrid dayStartMinute={settings.day_start_minute} dayEndMinute={settings.day_end_minute} blocks={blocks} />
      )}
      <p className="text-xs text-slate-500">Tip: click a block on the grid to remove it.</p>

      {sortedEntries.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-white">All entries</h2>
          <ul className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-900/40">
            {sortedEntries.map((e) => {
              const subject = subjects.find((s) => s.id === e.subject_id)
              return (
                <li key={e.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: subject?.color ?? '#475569' }} />
                  <span className="w-10 shrink-0 text-xs font-medium text-slate-400">{DAY_LABELS[e.day_of_week]}</span>
                  <span className="w-28 shrink-0 text-xs text-slate-400">
                    {minutesToTimeInput(e.start_minute)}–{minutesToTimeInput(e.end_minute)}
                  </span>
                  <span className="min-w-[140px] flex-1 truncate text-slate-200">{e.title}</span>
                  <RecurrenceSelect
                    value={e.recurrence}
                    onChange={(r) => update(e.id, { recurrence: r })}
                    className="rounded-md border border-slate-800 bg-slate-950 px-2 py-1 text-xs text-slate-300 outline-none"
                  />
                  <button
                    onClick={() => remove(e.id)}
                    className="rounded-md px-2 py-1 text-xs font-medium text-red-400 hover:bg-red-500/10"
                  >
                    Remove
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}
