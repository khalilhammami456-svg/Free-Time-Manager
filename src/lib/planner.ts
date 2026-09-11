import { addDays, differenceInCalendarDays, getISOWeek, parseISO } from 'date-fns'
import { DIFFICULTY_LABELS } from '../types'
import type { Assignment, DayOfWeek, Exam, FreeSlot, Recurrence, StudySession, Subject, TimetableEntry, UserSettings } from '../types'

export interface PlannedSession {
  subject_id: string
  day_of_week: DayOfWeek
  start_minute: number
  end_minute: number
  is_review: boolean
  placement_reason: string
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
export function computeFreeSlots(
  entries: TimetableEntry[],
  settings: UserSettings,
  weekStart: Date,
  /** Additional busy blocks to subtract alongside the timetable — e.g. already-scheduled
   * sessions, when computing what's still free for a catch-up session this week. */
  extraBusy: Array<Pick<StudySession, 'day_of_week' | 'start_minute' | 'end_minute'>> = []
): FreeSlot[] {
  const slots: FreeSlot[] = []
  const activeEntries = entries.filter((e) => isEntryActiveForWeek(e, weekStart))

  for (let day = 0 as DayOfWeek; day <= 6; day++) {
    const busy = [
      ...activeEntries.filter((e) => e.day_of_week === day).map((e) => [e.start_minute, e.end_minute] as const),
      ...extraBusy.filter((e) => e.day_of_week === day).map((e) => [e.start_minute, e.end_minute] as const),
    ].sort((a, b) => a[0] - b[0])

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

/** A free slot with a class immediately before AND after it that same day (as opposed to
 * the open-ended stretch before the first class or after the last one). */
function isInteriorGap(slot: FreeSlot, settings: UserSettings): boolean {
  return slot.start_minute > settings.day_start_minute && slot.end_minute < settings.day_end_minute
}

/** Splits a slot into the portion(s) outside the user's preferred study window and the
 * portion inside it, preserving order (before / within / after). */
function splitByPreferredWindow(slot: FreeSlot, prefStart: number, prefEnd: number): Array<FreeSlot & { preferred: boolean }> {
  const pieces: Array<FreeSlot & { preferred: boolean }> = []
  const { day_of_week, start_minute: s, end_minute: e } = slot
  const overlapStart = Math.max(s, prefStart)
  const overlapEnd = Math.min(e, prefEnd)

  if (s < overlapStart) pieces.push({ day_of_week, start_minute: s, end_minute: Math.min(e, overlapStart), preferred: false })
  if (overlapStart < overlapEnd) pieces.push({ day_of_week, start_minute: overlapStart, end_minute: overlapEnd, preferred: true })
  if (overlapEnd < e) pieces.push({ day_of_week, start_minute: Math.max(s, overlapEnd), end_minute: e, preferred: false })

  return pieces
}

/**
 * How much extra weight a subject's proportional share gets based on how soon its next
 * deadline (exam or assignment) falls, relative to the week being planned. Flat 3x once it's
 * within this week, tapers linearly down to 1x (no boost) by three weeks out, and 1x beyond
 * that or with no deadline at all.
 */
function examUrgencyMultiplier(daysUntilDeadline: number | null): number {
  if (daysUntilDeadline === null || daysUntilDeadline < 0 || daysUntilDeadline > 21) return 1
  if (daysUntilDeadline <= 6) return 3
  return 1 + (2 * (21 - daysUntilDeadline)) / (21 - 6)
}

/** For each subject, the smallest non-negative day-gap to its nearest exam or assignment due date from `weekStart`. */
function nextDeadlineDaysBySubject(exams: Exam[], assignments: Assignment[], weekStart: Date): Map<string, number> {
  const map = new Map<string, number>()
  const consider = (subjectId: string, dateStr: string) => {
    const days = differenceInCalendarDays(parseISO(dateStr), weekStart)
    if (days < 0) return
    const current = map.get(subjectId)
    if (current === undefined || days < current) map.set(subjectId, days)
  }
  for (const exam of exams) consider(exam.subject_id, exam.exam_date)
  for (const a of assignments) consider(a.subject_id, a.due_date)
  return map
}

/** A one-line, user-facing explanation of why a session landed where it did. */
function describePlacement(
  subject: Subject,
  opts: { preferred: boolean; explicitTarget: boolean; urgencyDays: number | null }
): string {
  const why = opts.explicitTarget
    ? `you set a fixed weekly target for ${subject.name}`
    : opts.urgencyDays !== null && opts.urgencyDays <= 21
      ? `${subject.name} has a deadline in ${opts.urgencyDays} day${opts.urgencyDays === 1 ? '' : 's'}`
      : `${subject.name} is rated ${DIFFICULTY_LABELS[subject.difficulty].toLowerCase()}`
  const window = opts.preferred
    ? 'this falls in your stated productive hours'
    : 'your productive hours were already full, so this spilled into the rest of the day'
  const sentence = `${why} — ${window}.`
  return sentence.charAt(0).toUpperCase() + sentence.slice(1)
}

interface AllocationInput {
  freeSlots: FreeSlot[]
  subjects: Subject[]
  settings: UserSettings
  /** This week's active classes — used to place a review session right before each one. */
  timetable: TimetableEntry[]
  /** All the user's exams — used to ramp up study time as an exam nears. */
  exams: Exam[]
  /** All the user's assignments — given the same deadline-urgency ramp-up as exams. */
  assignments?: Assignment[]
  weekStart: Date
}

/**
 * Distributes free time slots into study sessions per subject, weighted by
 * subject difficulty (harder subjects receive proportionally more time).
 *
 * Three rules shape where sessions land:
 * 1. A short gap squeezed between two classes only counts as usable time once it clears
 *    `min_gap_for_study_minutes` — small breaks between back-to-back classes stay breaks.
 * 2. Within what's left, the user's preferred/most-productive hours are filled first; the
 *    rest of the day is only used if that window isn't enough to cover the weekly pool.
 * 3. Before any of that, each subject gets one review session in the free time immediately
 *    before its next class this week, so the user walks in prepared — this is a deliberate
 *    exception to rule 1, since a short pre-class review is still worth having.
 * 4. A subject with an exam coming up gets a bigger share of the pool the closer it gets,
 *    pulling time away from subjects without one (explicit weekly-target subjects are exempt —
 *    that number is an intentional override, not something to silently inflate).
 */
export function allocateStudyPlan({
  freeSlots,
  subjects,
  settings,
  timetable,
  exams,
  assignments = [],
  weekStart,
}: AllocationInput): PlannedSession[] {
  if (subjects.length === 0 || freeSlots.length === 0) return []

  const sessions: PlannedSession[] = []
  const dayUsedMinutes = new Map<number, number>()
  const subjectsById = new Map(subjects.map((s) => [s.id, s]))
  const MIN_TAIL_SESSION = 15 // allow a short session to use up a slot's final leftover minutes

  // ---- Subject weekly targets, sized against the time we'll actually be able to use ----
  const eligibleSlots = freeSlots.filter((s) => !isInteriorGap(s, settings) || s.end_minute - s.start_minute >= settings.min_gap_for_study_minutes)
  const totalEligibleMinutes = eligibleSlots.reduce((sum, s) => sum + (s.end_minute - s.start_minute), 0)
  const weeklyCap = settings.daily_study_target_minutes * 7
  const weeklyPool = Math.min(totalEligibleMinutes, weeklyCap)

  const explicitSubjects = subjects.filter((s) => s.weekly_target_minutes != null && s.weekly_target_minutes > 0)
  const proportionalSubjects = subjects.filter((s) => !(s.weekly_target_minutes != null && s.weekly_target_minutes > 0))
  const explicitSubjectIds = new Set(explicitSubjects.map((s) => s.id))

  const remaining = new Map<string, number>()

  let explicitTotal = explicitSubjects.reduce((sum, s) => sum + (s.weekly_target_minutes ?? 0), 0)
  const scale = explicitTotal > weeklyPool && explicitTotal > 0 ? weeklyPool / explicitTotal : 1
  for (const s of explicitSubjects) {
    remaining.set(s.id, Math.round((s.weekly_target_minutes ?? 0) * scale))
  }
  explicitTotal = Math.min(explicitTotal, weeklyPool)

  const pool = Math.max(0, weeklyPool - explicitTotal)
  const nextDeadlineDays = nextDeadlineDaysBySubject(exams, assignments, weekStart)
  const weightOf = (s: Subject) => s.difficulty * examUrgencyMultiplier(nextDeadlineDays.get(s.id) ?? null)
  const totalWeight = proportionalSubjects.reduce((sum, s) => sum + weightOf(s), 0)
  for (const s of proportionalSubjects) {
    const share = totalWeight > 0 ? (weightOf(s) / totalWeight) * pool : 0
    remaining.set(s.id, Math.round(share))
  }

  // ---- Strategic pass: one review session right before each class this week ----
  const classOccurrences = timetable
    .filter((e) => e.subject_id !== null)
    .map((e) => ({ subject_id: e.subject_id as string, day_of_week: e.day_of_week, start_minute: e.start_minute }))
    .sort((a, b) => a.day_of_week - b.day_of_week || a.start_minute - b.start_minute)

  const workingSlots = freeSlots.map((s) => ({ ...s }))

  for (const occ of classOccurrences) {
    const desired = remaining.get(occ.subject_id) ?? 0
    if (desired <= 0) continue

    let candidate = workingSlots
      .filter((s) => s.day_of_week === occ.day_of_week && s.end_minute <= occ.start_minute)
      .sort((a, b) => b.end_minute - a.end_minute)[0]

    if (!candidate) {
      // Nothing free earlier that same day — fall back to the previous evening, if it's
      // genuinely open-ended (runs to the end of the day, not some unrelated short gap).
      const prevDay = ((occ.day_of_week + 6) % 7) as DayOfWeek
      candidate = workingSlots
        .filter((s) => s.day_of_week === prevDay && s.end_minute === settings.day_end_minute)
        .sort((a, b) => b.end_minute - a.end_minute)[0]
    }
    if (!candidate) continue

    const dayUsed = dayUsedMinutes.get(candidate.day_of_week) ?? 0
    const dayBudgetLeft = settings.daily_study_target_minutes - dayUsed
    const capacity = Math.min(candidate.end_minute - candidate.start_minute, dayBudgetLeft)
    const chunk = Math.min(settings.max_session_minutes, desired, capacity)
    if (chunk < settings.min_session_minutes || chunk <= 0) continue

    const start = candidate.end_minute - chunk
    const occSubject = subjectsById.get(occ.subject_id)
    sessions.push({
      subject_id: occ.subject_id,
      day_of_week: candidate.day_of_week,
      start_minute: start,
      end_minute: candidate.end_minute,
      is_review: true,
      placement_reason: `Placed right before your ${occSubject?.name ?? 'class'} so you walk in prepared.`,
    })
    remaining.set(occ.subject_id, desired - chunk)
    dayUsedMinutes.set(candidate.day_of_week, dayUsed + chunk)
    candidate.end_minute = start
  }

  // ---- General pass: fill what's left, preferred hours first ----
  const mainSlots = workingSlots.filter((s) => {
    const duration = s.end_minute - s.start_minute
    if (duration < settings.min_session_minutes) return false
    if (isInteriorGap(s, settings) && duration < settings.min_gap_for_study_minutes) return false
    return true
  })

  const pieces = mainSlots.flatMap((s) => splitByPreferredWindow(s, settings.preferred_study_start_minute, settings.preferred_study_end_minute))
  const byTime = (a: FreeSlot, b: FreeSlot) => a.day_of_week - b.day_of_week || a.start_minute - b.start_minute
  const orderedSlots = [...pieces.filter((p) => p.preferred).sort(byTime), ...pieces.filter((p) => !p.preferred).sort(byTime)]

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
        is_review: false,
        placement_reason: describePlacement(pick, {
          preferred: slot.preferred,
          explicitTarget: explicitSubjectIds.has(pick.id),
          urgencyDays: nextDeadlineDays.get(pick.id) ?? null,
        }),
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
  weekStart: Date,
  exams: Exam[] = [],
  assignments: Assignment[] = []
): { freeSlots: FreeSlot[]; sessions: PlannedSession[] } {
  const activeEntries = entries.filter((e) => isEntryActiveForWeek(e, weekStart))
  const freeSlots = computeFreeSlots(entries, settings, weekStart)
  const sessions = allocateStudyPlan({ freeSlots, subjects, settings, timetable: activeEntries, exams, assignments, weekStart })
  return { freeSlots, sessions }
}

/**
 * Given this week's remaining free time (timetable + already-scheduled sessions subtracted
 * out), finds the best slot to make up `minutesNeeded` of lost study time for a subject after
 * a session gets aborted — today or any later day this week. Returns null if nothing fits.
 */
export function findCatchUpSlot(
  entries: TimetableEntry[],
  sessions: Array<Pick<StudySession, 'day_of_week' | 'start_minute' | 'end_minute' | 'status'>>,
  settings: UserSettings,
  weekStart: Date,
  minutesNeeded: number,
  today: Date = new Date()
): { day_of_week: DayOfWeek; start_minute: number; end_minute: number } | null {
  const busySessions = sessions.filter((s) => s.status !== 'skipped')
  const freeSlots = computeFreeSlots(entries, settings, weekStart, busySessions)
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  const candidates = freeSlots.filter((slot) => {
    const slotDate = addDays(weekStart, (slot.day_of_week + 6) % 7)
    if (slotDate < todayStart) return false
    return slot.end_minute - slot.start_minute >= settings.min_session_minutes
  })
  if (candidates.length === 0) return null

  const exact = candidates.find((s) => s.end_minute - s.start_minute >= minutesNeeded)
  const chosen =
    exact ?? candidates.slice().sort((a, b) => b.end_minute - b.start_minute - (a.end_minute - a.start_minute))[0]
  const duration = Math.min(minutesNeeded, chosen.end_minute - chosen.start_minute)
  return { day_of_week: chosen.day_of_week, start_minute: chosen.start_minute, end_minute: chosen.start_minute + duration }
}
