export type Difficulty = 1 | 2 | 3 | 4 | 5

export interface Subject {
  id: string
  user_id: string
  name: string
  color: string
  difficulty: Difficulty
  weekly_target_minutes: number | null
  created_at: string
}

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6 // 0 = Sunday

// A class that meets "par quinzaine" (every two weeks) only happens on weeks of one parity.
// The parity is anchored to the ISO week number, not any particular semester start date.
export type Recurrence = 'weekly' | 'odd_weeks' | 'even_weeks'

export interface TimetableEntry {
  id: string
  user_id: string
  subject_id: string | null
  title: string
  day_of_week: DayOfWeek
  start_minute: number // minutes from midnight
  end_minute: number
  recurrence: Recurrence
  source: 'manual' | 'ocr'
  created_at: string
}

export type SessionStatus = 'planned' | 'completed' | 'skipped'
export type SessionSource = 'auto' | 'manual'

export interface StudySession {
  id: string
  user_id: string
  subject_id: string
  day_of_week: DayOfWeek
  start_minute: number
  end_minute: number
  status: SessionStatus
  source: SessionSource
  week_start: string // ISO date (Monday) this session instance belongs to
  skip_reason: string | null // why a focus session was ended early / abandoned
  is_review: boolean // true for the strategic session placed right before its linked class
  created_at: string
}

export interface UserSettings {
  user_id: string
  day_start_minute: number // e.g. 7:00 -> 420
  day_end_minute: number // e.g. 23:00 -> 1380
  min_session_minutes: number
  max_session_minutes: number
  buffer_minutes: number
  daily_study_target_minutes: number // caps how much of each day's free time becomes study time, so real free time survives
  // The window within day_start/day_end when the user is actually most focused — the planner
  // fills this first and only spills into the rest of the day if it isn't enough.
  preferred_study_start_minute: number
  preferred_study_end_minute: number
  // A free gap squeezed between two classes only counts as usable study time once it's at
  // least this long; short breaks between back-to-back classes stay real breaks.
  min_gap_for_study_minutes: number
  major: string | null
  program_intensity: Difficulty | null
  reminders_enabled: boolean
  reminder_lead_minutes: number
}

export interface FreeSlot {
  day_of_week: DayOfWeek
  start_minute: number
  end_minute: number
}

export interface Exam {
  id: string
  user_id: string
  subject_id: string
  exam_date: string // ISO date, 'yyyy-MM-dd'
  start_minute: number
  end_minute: number
  notes: string | null
  created_at: string
}

export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  1: 'Very easy',
  2: 'Easy',
  3: 'Medium',
  4: 'Hard',
  5: 'Very hard',
}

// Validated categorical palette (dark-surface, CVD-safe order) — do not reorder or cycle.
export const SUBJECT_COLORS = [
  '#3987e5', // blue
  '#d95926', // orange
  '#199e70', // aqua
  '#c98500', // yellow
  '#d55181', // magenta
  '#008300', // green
  '#9085e9', // violet
  '#e66767', // red
  '#1ba3c4', // cyan
  '#a3672a', // brown
  '#c45fc4', // pink
  '#6b8f1f', // lime
]
