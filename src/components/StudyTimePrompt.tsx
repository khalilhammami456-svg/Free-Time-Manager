import { useState } from 'react'
import Modal from './Modal'
import { minutesToTimeInput, timeInputToMinutes } from '../lib/format'

const PRESETS = [
  { key: 'morning', label: 'Morning', hint: '6 – 11 AM', start: 6 * 60, end: 11 * 60 },
  { key: 'afternoon', label: 'Afternoon', hint: '12 – 5 PM', start: 12 * 60, end: 17 * 60 },
  { key: 'evening', label: 'Evening', hint: '5 – 9 PM', start: 17 * 60, end: 21 * 60 },
  { key: 'night', label: 'Late night', hint: '9 PM – midnight', start: 21 * 60, end: 23 * 60 + 59 },
] as const

export default function StudyTimePrompt({
  initialStart,
  initialEnd,
  onConfirm,
  onClose,
}: {
  initialStart: number
  initialEnd: number
  onConfirm: (start: number, end: number, saveAsDefault: boolean) => void
  onClose: () => void
}) {
  const matchingPreset = PRESETS.find((p) => p.start === initialStart && p.end === initialEnd)
  const [selected, setSelected] = useState<string>(matchingPreset?.key ?? 'custom')
  const [start, setStart] = useState(initialStart)
  const [end, setEnd] = useState(initialEnd)
  const [saveAsDefault, setSaveAsDefault] = useState(true)

  const pick = (preset: (typeof PRESETS)[number]) => {
    setSelected(preset.key)
    setStart(preset.start)
    setEnd(preset.end)
  }

  return (
    <Modal title="When do you want to study?" onClose={onClose}>
      <p className="mb-4 text-xs text-slate-400">
        Not everyone studies best at the same time — pick when to fill first. We'll only use the
        rest of your day if this window isn't enough.
      </p>

      <div className="mb-3 grid grid-cols-2 gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => pick(p)}
            className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
              selected === p.key
                ? 'border-brand-500 bg-brand-500/10 text-white'
                : 'border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <div className="font-medium">{p.label}</div>
            <div className="text-[10px] text-slate-500">{p.hint}</div>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setSelected('custom')}
          className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
            selected === 'custom'
              ? 'border-brand-500 bg-brand-500/10 text-white'
              : 'border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <div className="font-medium">Custom</div>
          <div className="text-[10px] text-slate-500">Pick exact times</div>
        </button>
      </div>

      {selected === 'custom' && (
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">From</label>
            <input
              type="time"
              value={minutesToTimeInput(start)}
              onChange={(e) => setStart(timeInputToMinutes(e.target.value))}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Until</label>
            <input
              type="time"
              value={minutesToTimeInput(end)}
              onChange={(e) => setEnd(timeInputToMinutes(e.target.value))}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
            />
          </div>
        </div>
      )}

      <label className="mb-4 flex items-center gap-2 text-xs text-slate-400">
        <input
          type="checkbox"
          checked={saveAsDefault}
          onChange={(e) => setSaveAsDefault(e.target.checked)}
          className="h-4 w-4 accent-brand-600"
        />
        Remember this as my usual study time
      </label>

      <button
        onClick={() => onConfirm(start, end, saveAsDefault)}
        disabled={end <= start}
        className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
      >
        ✨ Generate plan
      </button>
    </Modal>
  )
}
