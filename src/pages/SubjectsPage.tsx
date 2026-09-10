import { useState, type FormEvent } from 'react'
import { useSubjects } from '../lib/hooks'
import { DIFFICULTY_LABELS, SUBJECT_COLORS, type Difficulty } from '../types'

export default function SubjectsPage() {
  const { subjects, loading, create, update, remove } = useSubjects()
  const [name, setName] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty>(3)
  const [color, setColor] = useState(SUBJECT_COLORS[0])
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSubmitting(true)
    try {
      await create({ name: name.trim(), color, difficulty, weekly_target_minutes: null })
      setName('')
      setColor(SUBJECT_COLORS[(subjects.length + 1) % SUBJECT_COLORS.length])
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-xl font-semibold text-white">Subjects</h1>
        <p className="mt-1 text-sm text-slate-400">
          Rate how hard each subject is — the planner gives harder subjects more of your free time.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[160px] flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-400">Subject name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Calculus"
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-brand-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Difficulty</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(Number(e.target.value) as Difficulty)}
              className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-brand-500"
            >
              {([1, 2, 3, 4, 5] as Difficulty[]).map((d) => (
                <option key={d} value={d}>
                  {d} — {DIFFICULTY_LABELS[d]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Color</label>
            <div className="flex gap-1.5 rounded-lg border border-slate-800 bg-slate-950 px-2 py-2">
              {SUBJECT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-5 w-5 rounded-full ${color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-950' : ''}`}
                  style={{ backgroundColor: c }}
                  aria-label={c}
                />
              ))}
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting || !name.trim()}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
          >
            Add subject
          </button>
        </div>
      </form>

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : subjects.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-800 p-6 text-center text-sm text-slate-500">
          No subjects yet. Add your first one above.
        </p>
      ) : (
        <ul className="space-y-2">
          {subjects.map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3"
            >
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="flex-1 truncate text-sm font-medium text-white">{s.name}</span>
              <select
                value={s.difficulty}
                onChange={(e) => update(s.id, { difficulty: Number(e.target.value) as Difficulty })}
                className="rounded-md border border-slate-800 bg-slate-950 px-2 py-1 text-xs text-slate-300 outline-none"
              >
                {([1, 2, 3, 4, 5] as Difficulty[]).map((d) => (
                  <option key={d} value={d}>
                    {d} — {DIFFICULTY_LABELS[d]}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                placeholder="auto"
                value={s.weekly_target_minutes ?? ''}
                onChange={(e) =>
                  update(s.id, { weekly_target_minutes: e.target.value === '' ? null : Number(e.target.value) })
                }
                title="Weekly target minutes (optional override)"
                className="w-20 rounded-md border border-slate-800 bg-slate-950 px-2 py-1 text-xs text-slate-300 outline-none"
              />
              <button
                onClick={() => remove(s.id)}
                className="rounded-md px-2 py-1 text-xs font-medium text-red-400 hover:bg-red-500/10"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
