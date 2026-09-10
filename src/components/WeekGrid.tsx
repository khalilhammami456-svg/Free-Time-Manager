import type { ReactNode } from 'react'
import { DAY_LABELS } from '../types'
import { minutesToLabel } from '../lib/format'

export interface WeekGridBlock {
  id: string
  day_of_week: number
  start_minute: number
  end_minute: number
  color: string
  label: string
  sublabel?: string
  muted?: boolean
  onClick?: () => void
}

interface WeekGridProps {
  dayStartMinute: number
  dayEndMinute: number
  blocks: WeekGridBlock[]
  renderBlock?: (block: WeekGridBlock) => ReactNode
  hourStep?: number
}

export default function WeekGrid({ dayStartMinute, dayEndMinute, blocks, renderBlock, hourStep = 2 }: WeekGridProps) {
  const totalMinutes = dayEndMinute - dayStartMinute
  const hourMarks: number[] = []
  for (let m = Math.ceil(dayStartMinute / 60) * 60; m <= dayEndMinute; m += 60 * hourStep) {
    hourMarks.push(m)
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
      <div className="grid min-w-[640px] grid-cols-[48px_repeat(7,1fr)]">
        <div className="border-b border-slate-800" />
        {DAY_LABELS.map((d) => (
          <div key={d} className="border-b border-l border-slate-800 py-2 text-center text-xs font-medium text-slate-400">
            {d}
          </div>
        ))}

        <div className="relative" style={{ height: totalMinutes }}>
          {hourMarks.map((m) => (
            <div
              key={m}
              className="absolute -translate-y-1/2 pr-2 text-right text-[10px] text-slate-600"
              style={{ top: m - dayStartMinute, right: 0 }}
            >
              {minutesToLabel(m)}
            </div>
          ))}
        </div>

        {Array.from({ length: 7 }, (_, day) => (
          <div key={day} className="relative border-l border-slate-800" style={{ height: totalMinutes }}>
            {hourMarks.map((m) => (
              <div key={m} className="absolute inset-x-0 border-t border-slate-800/60" style={{ top: m - dayStartMinute }} />
            ))}
            {blocks
              .filter((b) => b.day_of_week === day)
              .map((b) => {
                const top = b.start_minute - dayStartMinute
                const height = Math.max(b.end_minute - b.start_minute, 16)
                return (
                  <div
                    key={b.id}
                    onClick={b.onClick}
                    className={`absolute inset-x-0.5 overflow-hidden rounded-md px-1.5 py-1 text-left text-[11px] leading-tight text-white shadow-sm ${
                      b.onClick ? 'cursor-pointer' : ''
                    } ${b.muted ? 'opacity-60' : ''}`}
                    style={{ top, height, backgroundColor: b.color }}
                  >
                    {renderBlock ? (
                      renderBlock(b)
                    ) : (
                      <>
                        <div className="truncate font-medium">{b.label}</div>
                        {b.sublabel && <div className="truncate text-[10px] opacity-80">{b.sublabel}</div>}
                      </>
                    )}
                  </div>
                )
              })}
          </div>
        ))}
      </div>
    </div>
  )
}
