import { useEffect, useState } from 'react'
import { useSettings } from '../lib/hooks'
import { minutesToTimeInput, timeInputToMinutes } from '../lib/format'
import { requestNotificationPermission } from '../lib/notifications'
import { DIFFICULTY_LABELS, type Difficulty } from '../types'

// A rough starting point, not a hard rule — the user can always fine-tune the daily goal below.
const SUGGESTED_DAILY_MINUTES_BY_INTENSITY: Record<Difficulty, number> = {
  1: 60,
  2: 90,
  3: 120,
  4: 150,
  5: 180,
}

export default function SettingsPage() {
  const { settings, update } = useSettings()
  const [form, setForm] = useState(settings)
  const [saved, setSaved] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  )

  useEffect(() => {
    if (settings) setForm(settings)
  }, [settings])

  if (!form) return <p className="text-sm text-slate-500">Loading…</p>

  const handleSave = async () => {
    await update({
      day_start_minute: form.day_start_minute,
      day_end_minute: form.day_end_minute,
      min_session_minutes: form.min_session_minutes,
      max_session_minutes: form.max_session_minutes,
      buffer_minutes: form.buffer_minutes,
      daily_study_target_minutes: form.daily_study_target_minutes,
      preferred_study_start_minute: form.preferred_study_start_minute,
      preferred_study_end_minute: form.preferred_study_end_minute,
      min_gap_for_study_minutes: form.min_gap_for_study_minutes,
      major: form.major,
      program_intensity: form.program_intensity,
      reminders_enabled: form.reminders_enabled,
      reminder_lead_minutes: form.reminder_lead_minutes,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const enableNotifications = async () => {
    const perm = await requestNotificationPermission()
    setPermission(perm)
  }

  return (
    <div className="max-w-lg space-y-8">
      <header>
        <h1 className="text-xl font-semibold text-white">Settings</h1>
        <p className="mt-1 text-sm text-slate-400">Tune your available hours and session lengths.</p>
      </header>

      <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Day starts at</label>
            <input
              type="time"
              value={minutesToTimeInput(form.day_start_minute)}
              onChange={(e) => setForm({ ...form, day_start_minute: timeInputToMinutes(e.target.value) })}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Day ends at</label>
            <input
              type="time"
              value={minutesToTimeInput(form.day_end_minute)}
              onChange={(e) => setForm({ ...form, day_end_minute: timeInputToMinutes(e.target.value) })}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Shortest session (min)</label>
            <input
              type="number"
              min={5}
              value={form.min_session_minutes}
              onChange={(e) => setForm({ ...form, min_session_minutes: Number(e.target.value) })}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Longest session (min)</label>
            <input
              type="number"
              min={10}
              value={form.max_session_minutes}
              onChange={(e) => setForm({ ...form, max_session_minutes: Number(e.target.value) })}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Daily study goal (min)</label>
          <input
            type="number"
            min={15}
            step={15}
            value={form.daily_study_target_minutes}
            onChange={(e) => setForm({ ...form, daily_study_target_minutes: Number(e.target.value) })}
            className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
          />
          <p className="mt-1 text-xs text-slate-500">
            How much of each day's free time the planner fills with study sessions — the rest stays free.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Break between sessions (min)</label>
          <input
            type="number"
            min={0}
            value={form.buffer_minutes}
            onChange={(e) => setForm({ ...form, buffer_minutes: Number(e.target.value) })}
            className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">I focus best from</label>
            <input
              type="time"
              value={minutesToTimeInput(form.preferred_study_start_minute)}
              onChange={(e) => setForm({ ...form, preferred_study_start_minute: timeInputToMinutes(e.target.value) })}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">…until</label>
            <input
              type="time"
              value={minutesToTimeInput(form.preferred_study_end_minute)}
              onChange={(e) => setForm({ ...form, preferred_study_end_minute: timeInputToMinutes(e.target.value) })}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
            />
          </div>
          <p className="col-span-2 -mt-2 text-xs text-slate-500">
            The planner fills this window first (e.g. no 7am sessions if you're not a morning
            person) and only spills into the rest of your day if it isn't enough.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">
            Minimum gap between classes to use for study (hours)
          </label>
          <input
            type="number"
            min={0}
            step={0.5}
            value={form.min_gap_for_study_minutes / 60}
            onChange={(e) => setForm({ ...form, min_gap_for_study_minutes: Math.round(Number(e.target.value) * 60) })}
            className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
          />
          <p className="mt-1 text-xs text-slate-500">
            A short gap squeezed between two classes stays a real break — only gaps longer than
            this get used for study.
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <label className="block text-xs font-medium text-slate-400">Reminders</label>
            <p className="text-xs text-slate-500">Notify before a study session starts</p>
          </div>
          <input
            type="checkbox"
            checked={form.reminders_enabled}
            onChange={(e) => setForm({ ...form, reminders_enabled: e.target.checked })}
            className="h-5 w-5 accent-brand-600"
          />
        </div>

        {form.reminders_enabled && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Remind me (minutes before)</label>
            <input
              type="number"
              min={1}
              value={form.reminder_lead_minutes}
              onChange={(e) => setForm({ ...form, reminder_lead_minutes: Number(e.target.value) })}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
            />
          </div>
        )}

        <button
          onClick={handleSave}
          className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-500"
        >
          {saved ? 'Saved ✓' : 'Save settings'}
        </button>
      </section>

      <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div>
          <h2 className="mb-1 text-sm font-semibold text-white">Your program</h2>
          <p className="text-xs text-slate-400">
            Used to suggest how much daily study time a program like yours typically needs.
          </p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Major / field of study</label>
          <input
            value={form.major ?? ''}
            onChange={(e) => setForm({ ...form, major: e.target.value || null })}
            placeholder="e.g. Computer Science"
            className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">How demanding is it?</label>
          <select
            value={form.program_intensity ?? ''}
            onChange={(e) =>
              setForm({ ...form, program_intensity: e.target.value === '' ? null : (Number(e.target.value) as Difficulty) })
            }
            className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
          >
            <option value="">Not set</option>
            {([1, 2, 3, 4, 5] as Difficulty[]).map((d) => (
              <option key={d} value={d}>
                {d} — {DIFFICULTY_LABELS[d]}
              </option>
            ))}
          </select>
        </div>
        {form.program_intensity !== null && (
          <button
            type="button"
            onClick={async () => {
              const minutes = SUGGESTED_DAILY_MINUTES_BY_INTENSITY[form.program_intensity!]
              setForm({ ...form, daily_study_target_minutes: minutes })
              await update({ daily_study_target_minutes: minutes, major: form.major, program_intensity: form.program_intensity })
            }}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
          >
            Apply suggested daily goal ({SUGGESTED_DAILY_MINUTES_BY_INTENSITY[form.program_intensity]} min/day)
          </button>
        )}
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <h2 className="mb-1 text-sm font-semibold text-white">Browser notifications</h2>
        <p className="mb-3 text-xs text-slate-400">
          Required for reminders to appear while the app is open in this browser tab.
        </p>
        {permission === 'unsupported' && <p className="text-xs text-amber-400">Not supported in this browser.</p>}
        {permission === 'granted' && <p className="text-xs text-emerald-400">Notifications are enabled ✓</p>}
        {permission === 'denied' && (
          <p className="text-xs text-red-400">Blocked — enable notifications for this site in your browser settings.</p>
        )}
        {permission === 'default' && (
          <button
            onClick={enableNotifications}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
          >
            Enable notifications
          </button>
        )}
      </section>
    </div>
  )
}
