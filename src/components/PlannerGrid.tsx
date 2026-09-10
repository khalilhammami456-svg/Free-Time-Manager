import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { DAY_LABELS, type DayOfWeek, type StudySession, type Subject, type TimetableEntry } from '../types'
import { minutesToLabel } from '../lib/format'

interface PlannerGridProps {
  dayStartMinute: number
  dayEndMinute: number
  timetable: TimetableEntry[]
  sessions: StudySession[]
  subjects: Subject[]
  onSessionMove: (sessionId: string, day: DayOfWeek, startMinute: number) => void
  onSessionToggle: (sessionId: string) => void
  onSessionRemove: (sessionId: string) => void
}

function DayColumn({
  day,
  height,
  children,
}: {
  day: DayOfWeek
  height: number
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${day}` })
  return (
    <div
      ref={setNodeRef}
      className={`relative border-l border-slate-800 ${isOver ? 'bg-brand-500/5' : ''}`}
      style={{ height }}
    >
      {children}
    </div>
  )
}

function SessionBlock({
  session,
  subject,
  top,
  height,
  onToggle,
  onRemove,
}: {
  session: StudySession
  subject: Subject | undefined
  top: number
  height: number
  onToggle: () => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: session.id })
  const color = subject?.color ?? '#6366f1'

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`group absolute inset-x-0.5 overflow-hidden rounded-md px-1.5 py-1 text-left text-[11px] leading-tight text-white shadow-sm ${
        isDragging ? 'z-20 opacity-90 cursor-grabbing' : 'cursor-grab'
      } ${session.status === 'completed' ? 'opacity-60' : ''} ${session.status === 'skipped' ? 'opacity-30 line-through' : ''}`}
      style={{
        top,
        height: Math.max(height, 20),
        backgroundColor: color,
        transform: transform ? CSS.Translate.toString(transform) : undefined,
      }}
    >
      <div className="flex items-start justify-between gap-1">
        <span className="truncate font-medium">{subject?.name ?? 'Study'}</span>
        <span className="flex shrink-0 gap-0.5 opacity-0 group-hover:opacity-100">
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onToggle}
            title={session.status === 'completed' ? 'Mark planned' : 'Mark complete'}
            className="rounded bg-black/30 px-1 text-[10px] leading-4"
          >
            {session.status === 'completed' ? '↺' : '✓'}
          </button>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onRemove}
            title="Remove"
            className="rounded bg-black/30 px-1 text-[10px] leading-4"
          >
            ✕
          </button>
        </span>
      </div>
      {height > 30 && <div className="truncate text-[10px] opacity-80">{minutesToLabel(session.start_minute)}</div>}
    </div>
  )
}

export default function PlannerGrid({
  dayStartMinute,
  dayEndMinute,
  timetable,
  sessions,
  subjects,
  onSessionMove,
  onSessionToggle,
  onSessionRemove,
}: PlannerGridProps) {
  const totalMinutes = dayEndMinute - dayStartMinute
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const hourMarks: number[] = []
  for (let m = Math.ceil(dayStartMinute / 60) * 60; m <= dayEndMinute; m += 60 * 2) {
    hourMarks.push(m)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta, over } = event
    const session = sessions.find((s) => s.id === active.id)
    if (!session) return

    const duration = session.end_minute - session.start_minute
    let newDay = session.day_of_week
    if (over && typeof over.id === 'string' && over.id.startsWith('day-')) {
      newDay = Number(over.id.slice(4)) as DayOfWeek
    }

    let newStart = Math.round((session.start_minute + delta.y) / 5) * 5
    newStart = Math.max(dayStartMinute, Math.min(newStart, dayEndMinute - duration))

    if (newDay === session.day_of_week && newStart === session.start_minute) return
    onSessionMove(session.id, newDay, newStart)
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
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
            <DayColumn key={day} day={day as DayOfWeek} height={totalMinutes}>
              {hourMarks.map((m) => (
                <div key={m} className="absolute inset-x-0 border-t border-slate-800/60" style={{ top: m - dayStartMinute }} />
              ))}

              {timetable
                .filter((e) => e.day_of_week === day)
                .map((e) => (
                  <div
                    key={e.id}
                    title={e.recurrence !== 'weekly' ? 'Every other week — not on this schedule next week' : undefined}
                    className="absolute inset-x-0.5 overflow-hidden rounded-md bg-slate-700/70 px-1.5 py-1 text-[10px] text-slate-300"
                    style={{ top: e.start_minute - dayStartMinute, height: Math.max(e.end_minute - e.start_minute, 16) }}
                  >
                    <span className="truncate">
                      {e.recurrence !== 'weekly' && <span className="mr-1 text-amber-400">⟳</span>}
                      {e.title}
                    </span>
                  </div>
                ))}

              {sessions
                .filter((s) => s.day_of_week === day)
                .map((s) => (
                  <SessionBlock
                    key={s.id}
                    session={s}
                    subject={subjects.find((sub) => sub.id === s.subject_id)}
                    top={s.start_minute - dayStartMinute}
                    height={s.end_minute - s.start_minute}
                    onToggle={() => onSessionToggle(s.id)}
                    onRemove={() => onSessionRemove(s.id)}
                  />
                ))}
            </DayColumn>
          ))}
        </div>
      </div>
    </DndContext>
  )
}
