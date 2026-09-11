import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { useAssignments, useSubjects } from '../lib/hooks'
import { matchSubjectId, type ParsedAssignmentRow } from '../lib/ocr'

function todayInputValue() {
  return format(new Date(), 'yyyy-MM-dd')
}

type OcrAssignmentRow = ParsedAssignmentRow & { include: boolean; subject_id: string | null }

export default function AssignmentsPage() {
  const { assignments, loading, create, remove } = useAssignments()
  const { subjects } = useSubjects()

  const [subjectId, setSubjectId] = useState('')
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState(todayInputValue())
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [ocrStatus, setOcrStatus] = useState<string | null>(null)
  const [ocrProgress, setOcrProgress] = useState(0)
  const [ocrRows, setOcrRows] = useState<OcrAssignmentRow[] | null>(null)
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
      const { extractAssignmentScheduleFromFile } = await import('../lib/ocr')
      const { rows } = await extractAssignmentScheduleFromFile(file, (status, progress) => {
        setOcrStatus(status)
        setOcrProgress(progress)
      })
      if (rows.length === 0) {
        setOcrError("Couldn't detect any dated deadlines in that file. Try a clearer scan, or add them manually below.")
      }
      setOcrRows(rows.map((r) => ({ ...r, include: true, subject_id: matchSubjectId(r.title_guess, subjects) })))
    } catch (err) {
      setOcrError(err instanceof Error ? err.message : 'Failed to scan the file.')
    } finally {
      setOcrStatus(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const updateOcrRow = (index: number, patch: Partial<OcrAssignmentRow>) => {
    setOcrRows((prev) => (prev ? prev.map((r, i) => (i === index ? { ...r, ...patch } : r)) : prev))
  }

  const saveOcrRows = async () => {
    if (!ocrRows) return
    const toSave = ocrRows.filter((r) => r.include && r.subject_id && r.due_date)
    if (toSave.length === 0) return
    await Promise.all(
      toSave.map((r) =>
        create({
          subject_id: r.subject_id as string,
          title: r.title_guess,
          due_date: r.due_date as string,
          notes: null,
        })
      )
    )
    setOcrRows(null)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!subjectId || !title.trim() || !dueDate) return
    setSubmitting(true)
    try {
      await create({ subject_id: subjectId, title: title.trim(), due_date: dueDate, notes: notes.trim() || null })
      setTitle('')
      setNotes('')
    } finally {
      setSubmitting(false)
    }
  }

  const sortedAssignments = useMemo(() => {
    const today = new Date()
    return assignments
      .map((a) => ({ ...a, daysAway: differenceInCalendarDays(parseISO(a.due_date), today) }))
      .sort((a, b) => a.due_date.localeCompare(b.due_date))
  }, [assignments])

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-xl font-semibold text-white">Assignments</h1>
        <p className="mt-1 text-sm text-slate-400">
          Add homework/deliverable deadlines — the planner shifts more study time to a subject as
          a due date gets closer, the same way it does for exams.
        </p>
      </header>

      {subjects.length === 0 ? (
        <p className="rounded-lg border border-amber-600/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          Add a subject first (on the Subjects page) before adding an assignment for it.
        </p>
      ) : (
        <>
          <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="mb-3 text-sm font-semibold text-white">Scan a syllabus or assignment list (photo or PDF)</h2>
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
                        <th className="py-1 pr-2">Due date</th>
                        <th className="py-1 pr-2">Title</th>
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
                              value={row.due_date ?? ''}
                              onChange={(e) => updateOcrRow(i, { due_date: e.target.value || null })}
                              className="rounded border border-slate-800 bg-slate-950 px-1 py-0.5 text-white"
                            />
                          </td>
                          <td className="py-1 pr-2">
                            <input
                              value={row.title_guess}
                              onChange={(e) => updateOcrRow(i, { title_guess: e.target.value })}
                              className="w-40 rounded border border-slate-800 bg-slate-950 px-1 py-0.5 text-white"
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
                          <td className="py-1 pr-2 text-slate-500">{row.raw}</td>
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
                    Add selected assignments
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
              <div className="min-w-[160px] flex-1">
                <label className="mb-1 block text-xs font-medium text-slate-400">Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Problem Set 3"
                  required
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Due date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                  className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
                />
              </div>
              <div className="min-w-[160px] flex-1">
                <label className="mb-1 block text-xs font-medium text-slate-400">Notes (optional)</label>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Submit via Moodle"
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-brand-500"
                />
              </div>
              <button
                type="submit"
                disabled={submitting || !subjectId || !title.trim()}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
              >
                Add assignment
              </button>
            </div>
          </form>
        </>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : sortedAssignments.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-800 p-6 text-center text-sm text-slate-500">
          No assignments yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {sortedAssignments.map((a) => {
            const subject = subjects.find((s) => s.id === a.subject_id)
            const isPast = a.daysAway < 0
            return (
              <li
                key={a.id}
                className={`flex flex-wrap items-center gap-4 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 ${isPast ? 'opacity-50' : ''}`}
              >
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: subject?.color ?? '#475569' }} />
                <div className="min-w-[140px] flex-1">
                  <div className="text-sm font-medium text-white">{a.title}</div>
                  <div className="text-xs text-slate-500">
                    {subject?.name ?? 'Unknown subject'}
                    {a.notes ? ` · ${a.notes}` : ''}
                  </div>
                </div>
                <span className="text-xs text-slate-400">{format(parseISO(a.due_date), 'EEE, MMM d')}</span>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    isPast
                      ? 'bg-slate-800 text-slate-500'
                      : a.daysAway <= 6
                        ? 'bg-red-500/10 text-red-300'
                        : a.daysAway <= 21
                          ? 'bg-amber-500/10 text-amber-300'
                          : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {isPast ? 'Past due' : a.daysAway === 0 ? 'Due today' : a.daysAway === 1 ? 'Due tomorrow' : `Due in ${a.daysAway} days`}
                </span>
                <button
                  onClick={() => remove(a.id)}
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
