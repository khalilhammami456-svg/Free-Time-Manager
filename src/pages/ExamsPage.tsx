import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { useExams, useSubjects } from '../lib/hooks'
import { matchSubjectId, type ParsedExamRow } from '../lib/ocr'
import { minutesToTimeInput, timeInputToMinutes } from '../lib/format'

function todayInputValue() {
  return format(new Date(), 'yyyy-MM-dd')
}

type OcrExamRow = ParsedExamRow & { include: boolean; subject_id: string | null }

const OUTCOME_STARS = [1, 2, 3, 4, 5] as const

export default function ExamsPage() {
  const { exams, loading, create, update, remove } = useExams()
  const { subjects } = useSubjects()

  const [subjectId, setSubjectId] = useState('')
  const [examDate, setExamDate] = useState(todayInputValue())
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('11:00')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [ocrStatus, setOcrStatus] = useState<string | null>(null)
  const [ocrProgress, setOcrProgress] = useState(0)
  const [ocrRows, setOcrRows] = useState<OcrExamRow[] | null>(null)
  const [ocrError, setOcrError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setOcrError(null)
    setOcrRows(null)
    setOcrStatus('loading scanner')
    setOcrProgress(0)
    try {
      const { extractExamScheduleFromFile } = await import('../lib/ocr')
      const { rows } = await extractExamScheduleFromFile(file, (status, progress) => {
        setOcrStatus(status)
        setOcrProgress(progress)
      })
      if (rows.length === 0) {
        setOcrError("Couldn't detect any dated exams in that file. Try a clearer scan, or add them manually below.")
      }
      setOcrRows(rows.map((r) => ({ ...r, include: true, subject_id: matchSubjectId(r.subject_guess, subjects) })))
    } catch (err) {
      setOcrError(err instanceof Error ? err.message : 'Failed to scan the file.')
    } finally {
      setOcrStatus(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const updateOcrRow = (index: number, patch: Partial<OcrExamRow>) => {
    setOcrRows((prev) => (prev ? prev.map((r, i) => (i === index ? { ...r, ...patch } : r)) : prev))
  }

  const saveOcrRows = async () => {
    if (!ocrRows) return
    const toSave = ocrRows.filter(
      (r) => r.include && r.subject_id && r.exam_date && r.start_minute !== null && r.end_minute !== null
    )
    if (toSave.length === 0) return
    await Promise.all(
      toSave.map((r) =>
        create({
          subject_id: r.subject_id as string,
          exam_date: r.exam_date as string,
          start_minute: r.start_minute as number,
          end_minute: r.end_minute as number,
          notes: null,
        })
      )
    )
    setOcrRows(null)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!subjectId || !examDate) return
    const start_minute = timeInputToMinutes(start)
    const end_minute = timeInputToMinutes(end)
    if (end_minute <= start_minute) return
    setSubmitting(true)
    try {
      await create({ subject_id: subjectId, exam_date: examDate, start_minute, end_minute, notes: notes.trim() || null })
      setNotes('')
    } finally {
      setSubmitting(false)
    }
  }

  const sortedExams = useMemo(() => {
    const today = new Date()
    return exams
      .map((exam) => ({ ...exam, daysAway: differenceInCalendarDays(parseISO(exam.exam_date), today) }))
      .sort((a, b) => a.exam_date.localeCompare(b.exam_date))
  }, [exams])

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-xl font-semibold text-white">Exams</h1>
        <p className="mt-1 text-sm text-slate-400">
          Add your exam dates — the planner automatically shifts more study time to a subject as
          its exam gets closer, tapering off over the 3 weeks before.
        </p>
      </header>

      {subjects.length === 0 ? (
        <p className="rounded-lg border border-amber-600/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          Add a subject first (on the Subjects page) before scheduling an exam for it.
        </p>
      ) : (
        <>
          <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="mb-3 text-sm font-semibold text-white">Scan an exam schedule (photo or PDF)</h2>
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
                  Review what we detected — dates without a year assume the nearest upcoming one — and pick the
                  subject for any we couldn't match automatically.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-xs">
                    <thead>
                      <tr className="text-left text-slate-500">
                        <th className="w-8 py-1"></th>
                        <th className="py-1 pr-2">Date</th>
                        <th className="py-1 pr-2">Start</th>
                        <th className="py-1 pr-2">End</th>
                        <th className="py-1 pr-2">Subject</th>
                        <th className="py-1 pr-2">Detected text</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ocrRows.map((row, i) => (
                        <tr key={i} className="border-t border-slate-800">
                          <td className="py-1">
                            <input
                              type="checkbox"
                              checked={row.include}
                              onChange={(e) => updateOcrRow(i, { include: e.target.checked })}
                            />
                          </td>
                          <td className="py-1 pr-2">
                            <input
                              type="date"
                              value={row.exam_date ?? ''}
                              onChange={(e) => updateOcrRow(i, { exam_date: e.target.value || null })}
                              className="rounded border border-slate-800 bg-slate-950 px-1 py-0.5 text-white"
                            />
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
                            <select
                              value={row.subject_id ?? ''}
                              onChange={(e) => updateOcrRow(i, { subject_id: e.target.value || null })}
                              className="rounded border border-slate-800 bg-slate-950 px-1 py-0.5 text-white"
                            >
                              <option value="">—</option>
                              {subjects.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-1 pr-2 text-slate-500">{row.subject_guess}</td>
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
                    Add selected exams
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
</>
      )}
      {subjects.length > 0 && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Subject</label>
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                required
                className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
              >
                <option value="">Select…</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Date</label>
              <input
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                required
                className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
              />
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
            <div className="min-w-[160px] flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-400">Notes (optional)</label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Room B12, chapters 1-5"
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-brand-500"
              />
            </div>
            <button
              type="submit"
              disabled={submitting || !subjectId}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
            >
              Add exam
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : sortedExams.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-800 p-6 text-center text-sm text-slate-500">
          No exams scheduled yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {sortedExams.map((exam) => {
            const subject = subjects.find((s) => s.id === exam.subject_id)
            const isPast = exam.daysAway < 0
            return (
              <li
                key={exam.id}
                className={`flex flex-wrap items-center gap-4 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 ${isPast && exam.outcome_rating !== null ? 'opacity-50' : ''}`}
              >
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: subject?.color ?? '#475569' }} />
                <div className="min-w-[140px] flex-1">
                  <div className="text-sm font-medium text-white">{subject?.name ?? 'Unknown subject'}</div>
                  {exam.notes && <div className="text-xs text-slate-500">{exam.notes}</div>}
                  {isPast && (
                    <div className="mt-1 flex items-center gap-0.5">
                      {OUTCOME_STARS.map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => update(exam.id, { outcome_rating: n })}
                          title={`Rate ${n}/5`}
                          className={`text-sm leading-none ${
                            exam.outcome_rating !== null && n <= exam.outcome_rating ? 'text-amber-400' : 'text-slate-700 hover:text-slate-500'
                          }`}
                        >
                          ★
                        </button>
                      ))}
                      {exam.outcome_rating === null && (
                        <span className="ml-1.5 text-[10px] text-slate-500">How did it go?</span>
                      )}
                    </div>
                  )}
                </div>
                <span className="text-xs text-slate-400">
                  {format(parseISO(exam.exam_date), 'EEE, MMM d')} · {minutesToTimeInput(exam.start_minute)}–
                  {minutesToTimeInput(exam.end_minute)}
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    isPast
                      ? 'bg-slate-800 text-slate-500'
                      : exam.daysAway <= 6
                        ? 'bg-red-500/10 text-red-300'
                        : exam.daysAway <= 21
                          ? 'bg-amber-500/10 text-amber-300'
                          : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {isPast ? 'Past' : exam.daysAway === 0 ? 'Today' : exam.daysAway === 1 ? 'Tomorrow' : `In ${exam.daysAway} days`}
                </span>
                <button
                  onClick={() => remove(exam.id)}
                  className="rounded-md px-2 py-1 text-xs font-medium text-red-400 hover:bg-red-500/10"
                >
                  Remove
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
