import { describe, expect, it } from 'vitest'
import { allocateStudyPlan, computeFreeSlots } from './planner'
import type { Subject, TimetableEntry, UserSettings } from '../types'

const settings: UserSettings = {
  user_id: 'u1',
  day_start_minute: 8 * 60,
  day_end_minute: 20 * 60,
  min_session_minutes: 25,
  max_session_minutes: 60,
  buffer_minutes: 10,
  daily_study_target_minutes: 120,
  reminders_enabled: true,
  reminder_lead_minutes: 10,
}

function entry(day: number, start: number, end: number): TimetableEntry {
  return {
    id: `${day}-${start}`,
    user_id: 'u1',
    subject_id: null,
    title: 'class',
    day_of_week: day as TimetableEntry['day_of_week'],
    start_minute: start,
    end_minute: end,
    source: 'manual',
    created_at: '',
  }
}

describe('computeFreeSlots', () => {
  it('returns the full day window when there is no timetable', () => {
    const slots = computeFreeSlots([], settings)
    expect(slots).toHaveLength(7)
    expect(slots[0]).toEqual({ day_of_week: 0, start_minute: 480, end_minute: 1200 })
  })

  it('subtracts busy blocks and merges overlaps', () => {
    const entries = [entry(1, 9 * 60, 11 * 60), entry(1, 10 * 60 + 30, 12 * 60)]
    const slots = computeFreeSlots(entries, settings).filter((s) => s.day_of_week === 1)
    expect(slots).toEqual([
      { day_of_week: 1, start_minute: 480, end_minute: 540 }, // 8-9
      { day_of_week: 1, start_minute: 720, end_minute: 1200 }, // 12-20
    ])
  })

  it('drops slots shorter than the minimum session length', () => {
    const entries = [entry(2, 480, 500), entry(2, 510, 1200)] // leaves only a 10-min gap
    const slots = computeFreeSlots(entries, settings).filter((s) => s.day_of_week === 2)
    expect(slots).toHaveLength(0)
  })
})

describe('allocateStudyPlan', () => {
  const subjects: Subject[] = [
    { id: 'hard', user_id: 'u1', name: 'Hard', color: '#000', difficulty: 5, weekly_target_minutes: null, created_at: '' },
    { id: 'easy', user_id: 'u1', name: 'Easy', color: '#000', difficulty: 1, weekly_target_minutes: null, created_at: '' },
  ]

  it('gives the harder subject more total minutes than the easier one', () => {
    const freeSlots = computeFreeSlots([], settings)
    const sessions = allocateStudyPlan({ freeSlots, subjects, settings })

    const totalFor = (id: string) =>
      sessions.filter((s) => s.subject_id === id).reduce((sum, s) => sum + (s.end_minute - s.start_minute), 0)

    expect(totalFor('hard')).toBeGreaterThan(totalFor('easy'))
  })

  it('never schedules overlapping sessions within the same slot', () => {
    const freeSlots = computeFreeSlots([], settings)
    const sessions = allocateStudyPlan({ freeSlots, subjects, settings })

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
    const freeSlots = computeFreeSlots([], settings)
    const sessions = allocateStudyPlan({ freeSlots, subjects: capped, settings })
    const total = sessions.reduce((sum, s) => sum + (s.end_minute - s.start_minute), 0)
    expect(total).toBeLessThanOrEqual(50)
  })

  it('never schedules more than the daily study target on any single day, leaving real free time', () => {
    const freeSlots = computeFreeSlots([], settings) // 12h/day free, but cap is 120min/day
    const sessions = allocateStudyPlan({ freeSlots, subjects, settings })

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
    const freeSlots = computeFreeSlots(entries, settings)
    const sessions = allocateStudyPlan({ freeSlots, subjects, settings })
    expect(sessions).toEqual([])
  })
})
