import { useState } from 'react'
import Modal from './Modal'
import { minutesToTimeInput, timeInputToMinutes } from '../lib/format'
import { DAY_LABELS, type DayOfWeek, type StudySession, type Subject } from '../types'

export default function SessionActionModal({
  session,
  subject,
  onClose,
  onStartStudy,
  onSaveEdit,
  onToggle,
  onRemove,
}: {
  session: StudySession
  subject: Subject | undefined
  onClose: () => void
  onStartStudy: () => void
  onSaveEdit: (patch: { day_of_week: DayOfWeek; start_minute: number; end_minute: number }) => void
  onToggle: () => void
  onRemove: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [day, setDay] = useState<DayOfWeek>(session.day_of_week)
  const [start, setStart] = useState(minutesToTimeInput(session.start_minute))
  const [duration, setDuration] = useState(session.end_minute - session.start_minute)

  const handleSave = () => {
    const start_minute = timeInputToMinutes(start)
    onSaveEdit({ day_of_week: day, start_minute, end_minute: start_minute + duration })
  }

  return (
    <Modal title={editing ? 'Edit study time' : subject?.name ?? 'Study session'} onClose={onClose}>
      {!editing ? (
        <div className="space-y-2">
          {session.placement_reason && (
            <p className="mb-1 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs italic text-slate-400">
              {session.placement_reason}
            </p>
          )}
          {session.status === 'planned' && (
            <button
              onClick={onStartStudy}
              className="w-full rounded-lg bg-brand-600 py-2.5 text-left text-sm font-semibold text-white hover:bg-brand-500"
            >
              ▶ &nbsp;Start studying
            </button>
          )}
          <button
            onClick={() => setEditing(true)}
            className="w-full rounded-lg border border-slate-700 py-2.5 text-left text-sm font-medium text-slate-200 hover:bg-slate-800"
          >
            ✎ &nbsp;Edit day / time / duration
          </button>
          <button
            onClick={onToggle}
            className="w-full rounded-lg border border-slate-700 py-2.5 text-left text-sm font-medium text-slate-200 hover:bg-slate-800"
          >
            {session.status === 'completed' ? '↺  Mark as planned' : '✓  Mark as done'}
          </button>
          <button
            onClick={onRemove}
            className="w-full rounded-lg border border-red-900/50 py-2.5 text-left text-sm font-medium text-red-400 hover:bg-red-500/10"
          >
            ✕ &nbsp;Remove
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Day</label>
              <select
                value={day}
                onChange={(e) => setDay(Number(e.target.value) as DayOfWeek)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
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
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Duration (minutes)</label>
            <input
              type="number"
              min={5}
              step={5}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="flex-1 rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-500"
            >
              Save
            </button>
            <button
              onClick={() => setEditing(false)}
              className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800"
            >
              Back
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
