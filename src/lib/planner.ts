import { getISOWeek } from 'date-fns'
import type { DayOfWeek, FreeSlot, Recurrence, Subject, TimetableEntry, UserSettings } from '../types'

export interface PlannedSession {
  subject_id: string
  day_of_week: DayOfWeek
  start_minute: number
  end_minute: number
}

/**
 * A class that meets "every two weeks" only falls on weeks of one parity.
 * Anchored to the ISO week number so it's a stable, deterministic mapping
 * independent of any particular semester's start date.
 */
export function getWeekParity(weekStart: Date): Extract<Recurrence, 'odd_weeks' | 'even_weeks'> {
  return getISOWeek(weekStart) % 2 === 1 ? 'odd_weeks' : 'even_weeks'
}

export function isEntryActiveForWeek(entry: Pick<TimetableEntry, 'recurrence'>, weekStart: Date): boolean {
  return entry.recurrence === 'weekly' || entry.recurrence === getWeekParity(weekStart)
}

/**
 * Computes the free time slots for each day of the week by subtracting the
 * user's recurring timetable (classes/work/etc.) from their configured
 * available hours window. `weekStart` (the Monday of the week being planned)
 * determines which "par quinzaine" (biweekly) entries apply this week.
 */
export function computeFreeSlots(entries: TimetableEntry[], settings: UserSettings, weekStart: Date): FreeSlot[] {
  const slots: FreeSlot[] = []
  const activeEntries = entries.filter((e) => isEntryActiveForWeek(e, weekStart))

  for (let day = 0 as DayOfWeek; day <= 6; day++) {
    const busy = activeEntries
      .filter((e) => e.day_of_week === day)
      .map((e) => [e.start_minute, e.end_minute] as const)
      .sort((a, b) => a[0] - b[0])

    // Merge overlapping/adjacent busy blocks.
    const merged: Array<[number, number]> = []
    for (const [start, end] of busy) {
      const last = merged[merged.length - 1]
      if (last && start <= last[1]) {
        last[1] = Math.max(last[1], end)
      } else {
        merged.push([start, end])
      }
    }

    let cursor = settings.day_start_minute
    for (const [start, end] of merged) {
      const clippedStart = Math.max(start, settings.day_start_minute)
      const clippedEnd = Math.min(end, settings.day_end_minute)
      if (clippedStart > cursor) {
        slots.push({ day_of_week: day, start_minute: cursor, end_minute: clippedStart })
      }
      cursor = Math.max(cursor, clippedEnd)
    }
    if (cursor < settings.day_end_minute) {
      slots.push({ day_of_week: day, start_minute: cursor, end_minute: settings.day_end_minute })
    }
  }

  return slots.filter((s) => s.end_minute - s.start_minute >= settings.min_session_minutes)
}

interface AllocationInput {
  freeSlots: FreeSlot[]
  subjects: Subject[]
  settings: UserSettings
}

/**
 * Distributes free time slots into study sessions per subject, weighted by
 * subject difficulty (harder subjects receive proportionally more time),
 * spread across the week rather than clustered on one day.
 */
export function allocateStudyPlan({ freeSlots, subjects, settings }: AllocationInput): PlannedSession[] {
  if (subjects.length === 0 || freeSlots.length === 0) return []

  const totalFreeMinutes = freeSlots.reduce((sum, s) => sum + (s.end_minute - s.start_minute), 0)
  // Cap how much of the week gets filled with study time so real free/rest time survives —
  // a free-time manager that schedules every waking minute has defeated its own purpose.
  const weeklyCap = settings.daily_study_target_minutes * 7
  const weeklyPool = Math.min(totalFreeMinutes, weeklyCap)

  const explicitSubjects = subjects.filter((s) => s.weekly_target_minutes != null && s.weekly_target_minutes > 0)
  const proportionalSubjects = subjects.filter((s) => !(s.weekly_target_minutes != null && s.weekly_target_minutes > 0))

  const remaining = new Map<string, number>()

  let explicitTotal = explicitSubjects.reduce((sum, s) => sum + (s.weekly_target_minutes ?? 0), 0)
  const scale = explicitTotal > weeklyPool && explicitTotal > 0 ? weeklyPool / explicitTotal : 1
  for (const s of explicitSubjects) {
    remaining.set(s.id, Math.round((s.weekly_target_minutes ?? 0) * scale))
  }
  explicitTotal = Math.min(explicitTotal, weeklyPool)

  const pool = Math.max(0, weeklyPool - explicitTotal)
  const totalWeight = proportionalSubjects.reduce((sum, s) => sum + s.difficulty, 0)
  for (const s of proportionalSubjects) {
    const share = totalWeight > 0 ? (s.difficulty / totalWeight) * pool : 0
    remaining.set(s.id, Math.round(share))
  }

  const orderedSlots = [...freeSlots].sort(
    (a, b) => a.day_of_week - b.day_of_week || a.start_minute - b.start_minute
  )

  const sessions: PlannedSession[] = []
  const MIN_TAIL_SESSION = 15 // allow a short session to use up a slot's final leftover minutes
  const dayUsedMinutes = new Map<number, number>()

  for (const slot of orderedSlots) {
    let cursor = slot.start_minute
    let lastSubjectId: string | null = null

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const dayUsed = dayUsedMinutes.get(slot.day_of_week) ?? 0
      const dayBudget = settings.daily_study_target_minutes - dayUsed
      const capacity = Math.min(slot.end_minute - cursor, dayBudget)
      if (capacity < settings.min_session_minutes && capacity < MIN_TAIL_SESSION) break

      const candidates = subjects
        .filter((s) => (remaining.get(s.id) ?? 0) > 0)
        .sort((a, b) => (remaining.get(b.id) ?? 0) - (remaining.get(a.id) ?? 0))

      if (candidates.length === 0) break

      const pick = candidates.find((s) => s.id !== lastSubjectId) ?? candidates[0]
      const desired = remaining.get(pick.id) ?? 0
      const chunk = Math.min(settings.max_session_minutes, desired, capacity)
      if (chunk < settings.min_session_minutes && chunk < capacity) break
      if (chunk <= 0) break

      sessions.push({
        subject_id: pick.id,
        day_of_week: slot.day_of_week,
        start_minute: cursor,
        end_minute: cursor + chunk,
      })

      remaining.set(pick.id, desired - chunk)
      dayUsedMinutes.set(slot.day_of_week, dayUsed + chunk)
      lastSubjectId = pick.id
      cursor += chunk + settings.buffer_minutes
    }
  }

  return sessions
}

export function generatePlan(
  entries: TimetableEntry[],
  subjects: Subject[],
  settings: UserSettings,
  weekStart: Date
): { freeSlots: FreeSlot[]; sessions: PlannedSession[] } {
  const freeSlots = computeFreeSlots(entries, settings, weekStart)
  const sessions = allocateStudyPlan({ freeSlots, subjects, settings })
  return { freeSlots, sessions }
}
