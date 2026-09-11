import { describe, expect, it } from 'vitest'
import { allocateStudyPlan, computeFreeSlots, getWeekParity } from './planner'
import type { Exam, Recurrence, Subject, TimetableEntry, UserSettings } from '../types'

const settings: UserSettings = {
  user_id: 'u1',
  day_start_minute: 8 * 60,
  day_end_minute: 20 * 60,
  min_session_minutes: 25,
  max_session_minutes: 60,
  buffer_minutes: 10,
  daily_study_target_minutes: 120,
  // Matches the full day window by default so existing tests aren't affected by preferred-hours
  // prioritization — the dedicated test below narrows this to check the behavior specifically.
  preferred_study_start_minute: 8 * 60,
  preferred_study_end_minute: 20 * 60,
  min_gap_for_study_minutes: 240,
  major: null,
  program_intensity: null,
  reminders_enabled: true,
  reminder_lead_minutes: 10,
}

// Consecutive Mondays always have opposite ISO-week parity — used to test biweekly filtering
// without hardcoding which absolute week number is "odd" vs "even".
const mondayA = new Date('2026-01-05T00:00:00Z')
const mondayB = new Date('2026-01-12T00:00:00Z')

function entry(
  day: number,
  start: number,
  end: number,
  opts: { recurrence?: Recurrence; subject_id?: string | null } = {}
): TimetableEntry {
  return {
    id: `${day}-${start}-${opts.recurrence ?? 'weekly'}`,
    user_id: 'u1',
    subject_id: opts.subject_id ?? null,
    title: 'class',
    day_of_week: day as TimetableEntry['day_of_week'],
    start_minute: start,
    end_minute: end,
    recurrence: opts.recurrence ?? 'weekly',
    source: 'manual',
    created_at: '',
  }
}

describe('computeFreeSlots', () => {
  it('returns the full day window when there is no timetable', () => {
    const slots = computeFreeSlots([], settings, mondayA)
    expect(slots).toHaveLength(7)
    expect(slots[0]).toEqual({ day_of_week: 0, start_minute: 480, end_minute: 1200 })
  })

  it('subtracts busy blocks and merges overlaps', () => {
    const entries = [entry(1, 9 * 60, 11 * 60), entry(1, 10 * 60 + 30, 12 * 60)]
    const slots = computeFreeSlots(entries, settings, mondayA).filter((s) => s.day_of_week === 1)
    expect(slots).toEqual([
      { day_of_week: 1, start_minute: 480, end_minute: 540 }, // 8-9
      { day_of_week: 1, start_minute: 720, end_minute: 1200 }, // 12-20
    ])
  })

  it('drops slots shorter than the minimum session length', () => {
    const entries = [entry(2, 480, 500), entry(2, 510, 1200)] // leaves only a 10-min gap
    const slots = computeFreeSlots(entries, settings, mondayA).filter((s) => s.day_of_week === 2)
    expect(slots).toHaveLength(0)
  })

  it('only blocks time for a "par quinzaine" class on weeks matching its parity', () => {
    expect(getWeekParity(mondayA)).not.toBe(getWeekParity(mondayB))

    const biweekly = entry(1, 9 * 60, 11 * 60, { recurrence: getWeekParity(mondayA) })
    const slotsOnA = computeFreeSlots([biweekly], settings, mondayA).filter((s) => s.day_of_week === 1)
    const slotsOnB = computeFreeSlots([biweekly], settings, mondayB).filter((s) => s.day_of_week === 1)

    // Week A: the class is on, so 9-11 is busy (split into two free slots).
    expect(slotsOnA).toEqual([
      { day_of_week: 1, start_minute: 480, end_minute: 540 },
      { day_of_week: 1, start_minute: 660, end_minute: 1200 },
    ])
    // Week B (off week): the class doesn't happen, so the whole day is free.
    expect(slotsOnB).toEqual([{ day_of_week: 1, start_minute: 480, end_minute: 1200 }])
  })

  it('a "weekly" class blocks time on every week regardless of parity', () => {
    const weekly = entry(1, 9 * 60, 11 * 60)
    const slotsOnA = computeFreeSlots([weekly], settings, mondayA).filter((s) => s.day_of_week === 1)
    const slotsOnB = computeFreeSlots([weekly], settings, mondayB).filter((s) => s.day_of_week === 1)
    expect(slotsOnA).toEqual(slotsOnB)
    expect(slotsOnA).toHaveLength(2)
  })
})

describe('allocateStudyPlan', () => {
  const subjects: Subject[] = [
    { id: 'hard', user_id: 'u1', name: 'Hard', color: '#000', difficulty: 5, weekly_target_minutes: null, created_at: '' },
    { id: 'easy', user_id: 'u1', name: 'Easy', color: '#000', difficulty: 1, weekly_target_minutes: null, created_at: '' },
  ]

  it('gives the harder subject more total minutes than the easier one', () => {
    const freeSlots = computeFreeSlots([], settings, mondayA)
    const sessions = allocateStudyPlan({ freeSlots, subjects, settings, timetable: [], exams: [], weekStart: mondayA })

    const totalFor = (id: string) =>
      sessions.filter((s) => s.subject_id === id).reduce((sum, s) => sum + (s.end_minute - s.start_minute), 0)

    expect(totalFor('hard')).toBeGreaterThan(totalFor('easy'))
  })

  it('never schedules overlapping sessions within the same slot', () => {
    const freeSlots = computeFreeSlots([], settings, mondayA)
    const sessions = allocateStudyPlan({ freeSlots, subjects, settings, timetable: [], exams: [], weekStart: mondayA })

    const byDay = new Map<number, typeof sessions>()
    for (const s of sessions) {
      byDay.set(s.day_of_week, [...(byDay.get(s.day_of_week) ?? []), s])
    }
    for (const daySessions of byDay.values()) {
      const sorted = [...daySessions].sort((a, b) => a.start_minute - b.start_minute)
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i].start_minute).toBeGreaterThanOrEqual(sorted[i - 1].end_minute)
      }
    }
  })

  it('respects an explicit weekly target for a subject', () => {
    const capped: Subject[] = [
      { id: 'fixed', user_id: 'u1', name: 'Fixed', color: '#000', difficulty: 3, weekly_target_minutes: 50, created_at: '' },
    ]
    const freeSlots = computeFreeSlots([], settings, mondayA)
    const sessions = allocateStudyPlan({ freeSlots, subjects: capped, settings, timetable: [], exams: [], weekStart: mondayA })
    const total = sessions.reduce((sum, s) => sum + (s.end_minute - s.start_minute), 0)
    expect(total).toBeLessThanOrEqual(50)
  })

  it('never schedules more than the daily study target on any single day, leaving real free time', () => {
    const freeSlots = computeFreeSlots([], settings, mondayA) // 12h/day free, but cap is 120min/day
    const sessions = allocateStudyPlan({ freeSlots, subjects, settings, timetable: [], exams: [], weekStart: mondayA })

    const byDay = new Map<number, number>()
    for (const s of sessions) {
      byDay.set(s.day_of_week, (byDay.get(s.day_of_week) ?? 0) + (s.end_minute - s.start_minute))
    }
    for (const minutes of byDay.values()) {
      expect(minutes).toBeLessThanOrEqual(settings.daily_study_target_minutes)
    }
    const totalMinutes = sessions.reduce((sum, s) => sum + (s.end_minute - s.start_minute), 0)
    expect(totalMinutes).toBeLessThanOrEqual(settings.daily_study_target_minutes * 7)
  })

  it('returns nothing when there are no free slots', () => {
    const entries = Array.from({ length: 7 }, (_, d) => entry(d, settings.day_start_minute, settings.day_end_minute))
    const freeSlots = computeFreeSlots(entries, settings, mondayA)
    const sessions = allocateStudyPlan({ freeSlots, subjects, settings, timetable: [], exams: [], weekStart: mondayA })
    expect(sessions).toEqual([])
  })

  it('ignores a short gap squeezed between two classes, but keeps a long one', () => {
    // Mon: class 9-10, gap, class 11-12 (60min gap — too short) — then free the rest of the day.
    // Tue: class 9-10, gap, class 15-16 (5h gap — long enough) — then free the rest of the day.
    const entries = [
      entry(1, 9 * 60, 10 * 60),
      entry(1, 11 * 60, 12 * 60),
      entry(2, 9 * 60, 10 * 60),
      entry(2, 15 * 60, 16 * 60),
    ]
    const freeSlots = computeFreeSlots(entries, settings, mondayA)
    const sessions = allocateStudyPlan({ freeSlots, subjects, settings, timetable: [], exams: [], weekStart: mondayA })

    const usesShortMondayGap = sessions.some((s) => s.day_of_week === 1 && s.start_minute >= 600 && s.end_minute <= 660)
    const usesLongTuesdayGap = sessions.some((s) => s.day_of_week === 2 && s.start_minute >= 600 && s.end_minute <= 900)

    expect(usesShortMondayGap).toBe(false)
    expect(usesLongTuesdayGap).toBe(true)
  })

  it('fills the preferred study window before spilling into the rest of the day', () => {
    const narrow: UserSettings = { ...settings, preferred_study_start_minute: 14 * 60, preferred_study_end_minute: 16 * 60 }
    const oneSubject: Subject[] = [
      { id: 'only', user_id: 'u1', name: 'Only', color: '#000', difficulty: 3, weekly_target_minutes: 50, created_at: '' },
    ]
    const freeSlots = computeFreeSlots([], narrow, mondayA) // whole day free, 8am-8pm
    const sessions = allocateStudyPlan({ freeSlots, subjects: oneSubject, settings: narrow, timetable: [], exams: [], weekStart: mondayA })

    expect(sessions.length).toBeGreaterThan(0)
    for (const s of sessions) {
      expect(s.start_minute).toBeGreaterThanOrEqual(14 * 60)
      expect(s.end_minute).toBeLessThanOrEqual(16 * 60)
    }
  })

  it('places a review session right before a subject\'s class, even in an otherwise-too-short gap', () => {
    // A 60-minute gap (9-10) right before the "hard" class at 10 — normally excluded by the
    // 4h interior-gap rule, but the strategic pass should still use it for prep.
    const entries = [
      entry(1, 8 * 60, 9 * 60),
      entry(1, 10 * 60, 11 * 60, { subject_id: 'hard' }),
    ]
    const freeSlots = computeFreeSlots(entries, settings, mondayA)
    const sessions = allocateStudyPlan({ freeSlots, subjects, settings, timetable: entries, exams: [], weekStart: mondayA })

    const prep = sessions.find((s) => s.subject_id === 'hard' && s.day_of_week === 1 && s.end_minute === 600)
    expect(prep).toBeTruthy()
    expect(prep!.start_minute).toBeGreaterThanOrEqual(540)
  })

  it('gives a subject with an exam this week more time than an equal-difficulty subject without one', () => {
    const equalSubjects: Subject[] = [
      { id: 'soon', user_id: 'u1', name: 'Soon', color: '#000', difficulty: 3, weekly_target_minutes: null, created_at: '' },
      { id: 'later', user_id: 'u1', name: 'Later', color: '#000', difficulty: 3, weekly_target_minutes: null, created_at: '' },
    ]
    const exams: Exam[] = [
      { id: 'e1', user_id: 'u1', subject_id: 'soon', exam_date: '2026-01-08', start_minute: 540, end_minute: 600, notes: null, outcome_rating: null, outcome_notes: null, created_at: '' },
    ]
    const freeSlots = computeFreeSlots([], settings, mondayA)
    const sessions = allocateStudyPlan({ freeSlots, subjects: equalSubjects, settings, timetable: [], exams, weekStart: mondayA })

    const totalFor = (id: string) =>
      sessions.filter((s) => s.subject_id === id).reduce((sum, s) => sum + (s.end_minute - s.start_minute), 0)

    expect(totalFor('soon')).toBeGreaterThan(totalFor('later'))
  })

  it('does not boost a subject whose exam is more than 3 weeks out', () => {
    const equalSubjects: Subject[] = [
      { id: 'far', user_id: 'u1', name: 'Far', color: '#000', difficulty: 3, weekly_target_minutes: null, created_at: '' },
      { id: 'none', user_id: 'u1', name: 'None', color: '#000', difficulty: 3, weekly_target_minutes: null, created_at: '' },
    ]
    const exams: Exam[] = [
      { id: 'e1', user_id: 'u1', subject_id: 'far', exam_date: '2026-03-01', start_minute: 540, end_minute: 600, notes: null, outcome_rating: null, outcome_notes: null, created_at: '' },
    ]
    const freeSlots = computeFreeSlots([], settings, mondayA)
    const sessions = allocateStudyPlan({ freeSlots, subjects: equalSubjects, settings, timetable: [], exams, weekStart: mondayA })

    const totalFor = (id: string) =>
      sessions.filter((s) => s.subject_id === id).reduce((sum, s) => sum + (s.end_minute - s.start_minute), 0)

    expect(totalFor('far')).toBe(totalFor('none'))
  })
})
