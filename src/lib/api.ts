import { supabase } from './supabase'
import type {
  Subject,
  TimetableEntry,
  StudySession,
  UserSettings,
  Difficulty,
  DayOfWeek,
  SessionStatus,
  Recurrence,
  Exam,
  Assignment,
  Profile,
  SharedBusyBlock,
} from '../types'

async function unwrap<T>(promise: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await promise
  if (error) throw new Error(error.message)
  return data as T
}

// ---------------------------------------------------------------------------
// Subjects
// ---------------------------------------------------------------------------
export const subjectsApi = {
  list: (userId: string) =>
    unwrap<Subject[]>(
      supabase.from('subjects').select('*').eq('user_id', userId).order('created_at')
    ),

  create: (userId: string, input: { name: string; color: string; difficulty: Difficulty; weekly_target_minutes?: number | null }) =>
    unwrap<Subject[]>(
      supabase
        .from('subjects')
        .insert({ user_id: userId, ...input })
        .select()
    ).then((rows) => rows[0]),

  update: (id: string, patch: Partial<Pick<Subject, 'name' | 'color' | 'difficulty' | 'weekly_target_minutes'>>) =>
    unwrap<Subject[]>(supabase.from('subjects').update(patch).eq('id', id).select()).then((rows) => rows[0]),

  remove: (id: string) => unwrap(supabase.from('subjects').delete().eq('id', id).select()),
}

// ---------------------------------------------------------------------------
// Timetable entries
// ---------------------------------------------------------------------------
export const timetableApi = {
  list: (userId: string) =>
    unwrap<TimetableEntry[]>(
      supabase.from('timetable_entries').select('*').eq('user_id', userId).order('day_of_week').order('start_minute')
    ),

  create: (
    userId: string,
    input: {
      title: string
      subject_id: string | null
      day_of_week: DayOfWeek
      start_minute: number
      end_minute: number
      recurrence?: Recurrence
      source?: 'manual' | 'ocr'
    }
  ) =>
    unwrap<TimetableEntry[]>(
      supabase
        .from('timetable_entries')
        .insert({ user_id: userId, source: 'manual', recurrence: 'weekly', ...input })
        .select()
    ).then((rows) => rows[0]),

  createMany: (
    userId: string,
    entries: Array<{
      title: string
      subject_id: string | null
      day_of_week: DayOfWeek
      start_minute: number
      end_minute: number
      recurrence?: Recurrence
      source?: 'manual' | 'ocr'
    }>
  ) =>
    unwrap<TimetableEntry[]>(
      supabase
        .from('timetable_entries')
        .insert(entries.map((e) => ({ user_id: userId, source: 'manual', recurrence: 'weekly', ...e })))
        .select()
    ),

  update: (
    id: string,
    patch: Partial<Pick<TimetableEntry, 'title' | 'subject_id' | 'day_of_week' | 'start_minute' | 'end_minute' | 'recurrence'>>
  ) => unwrap<TimetableEntry[]>(supabase.from('timetable_entries').update(patch).eq('id', id).select()).then((rows) => rows[0]),

  remove: (id: string) => unwrap(supabase.from('timetable_entries').delete().eq('id', id).select()),
}

// ---------------------------------------------------------------------------
// Study sessions
// ---------------------------------------------------------------------------
export const sessionsApi = {
  listForWeek: (userId: string, weekStart: string) =>
    unwrap<StudySession[]>(
      supabase
        .from('study_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('week_start', weekStart)
        .order('day_of_week')
        .order('start_minute')
    ),

  listInRange: (userId: string, fromWeekStart: string, toWeekStart: string) =>
    unwrap<StudySession[]>(
      supabase
        .from('study_sessions')
        .select('*')
        .eq('user_id', userId)
        .gte('week_start', fromWeekStart)
        .lte('week_start', toWeekStart)
    ),

  replaceAutoForWeek: async (
    userId: string,
    weekStart: string,
    sessions: Array<
      Pick<StudySession, 'subject_id' | 'day_of_week' | 'start_minute' | 'end_minute' | 'is_review' | 'placement_reason'>
    >
  ) => {
    const { error: deleteError } = await supabase
      .from('study_sessions')
      .delete()
      .eq('user_id', userId)
      .eq('week_start', weekStart)
      .eq('source', 'auto')
    if (deleteError) throw new Error(deleteError.message)

    if (sessions.length === 0) return [] as StudySession[]

    return unwrap<StudySession[]>(
      supabase
        .from('study_sessions')
        .insert(
          sessions.map((s) => ({
            user_id: userId,
            week_start: weekStart,
            source: 'auto' as const,
            status: 'planned' as const,
            ...s,
          }))
        )
        .select()
    )
  },

  update: (
    id: string,
    patch: Partial<
      Pick<
        StudySession,
        'day_of_week' | 'start_minute' | 'end_minute' | 'status' | 'source' | 'skip_reason' | 'catch_up_dismissed'
      >
    >
  ) => unwrap<StudySession[]>(supabase.from('study_sessions').update(patch).eq('id', id).select()).then((rows) => rows[0]),

  /** Creates a single manual session directly — used e.g. for accepting a "catch up on missed time" suggestion. */
  create: (
    userId: string,
    input: { subject_id: string; day_of_week: DayOfWeek; start_minute: number; end_minute: number; week_start: string }
  ) =>
    unwrap<StudySession[]>(
      supabase
        .from('study_sessions')
        .insert({ user_id: userId, source: 'manual' as const, status: 'planned' as const, ...input })
        .select()
    ).then((rows) => rows[0]),

  setStatus: (id: string, status: SessionStatus) =>
    unwrap<StudySession[]>(supabase.from('study_sessions').update({ status }).eq('id', id).select()).then((rows) => rows[0]),

  /** Ends a focus session early (or on time): shrinks it to the minutes actually studied and marks it complete. */
  finishEarly: (id: string, actualEndMinute: number) =>
    unwrap<StudySession[]>(
      supabase.from('study_sessions').update({ end_minute: actualEndMinute, status: 'completed' as const }).eq('id', id).select()
    ).then((rows) => rows[0]),

  abort: (id: string, reason: string) =>
    unwrap<StudySession[]>(
      supabase.from('study_sessions').update({ status: 'skipped' as const, skip_reason: reason }).eq('id', id).select()
    ).then((rows) => rows[0]),

  /** How many times the user has aborted a session with this exact reason since `sinceIso` — used to tell a first-time slip from a pattern. */
  countRecentAbortsByReason: async (userId: string, reason: string, sinceIso: string): Promise<number> => {
    const { count, error } = await supabase
      .from('study_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'skipped')
      .eq('skip_reason', reason)
      .gte('created_at', sinceIso)
    if (error) throw new Error(error.message)
    return count ?? 0
  },

  remove: (id: string) => unwrap(supabase.from('study_sessions').delete().eq('id', id).select()),
}

// ---------------------------------------------------------------------------
// Exams
// ---------------------------------------------------------------------------
export const examsApi = {
  list: (userId: string) =>
    unwrap<Exam[]>(supabase.from('exams').select('*').eq('user_id', userId).order('exam_date')),

  create: (
    userId: string,
    input: { subject_id: string; exam_date: string; start_minute: number; end_minute: number; notes?: string | null }
  ) =>
    unwrap<Exam[]>(
      supabase
        .from('exams')
        .insert({ user_id: userId, ...input })
        .select()
    ).then((rows) => rows[0]),

  update: (
    id: string,
    patch: Partial<
      Pick<Exam, 'subject_id' | 'exam_date' | 'start_minute' | 'end_minute' | 'notes' | 'outcome_rating' | 'outcome_notes'>
    >
  ) => unwrap<Exam[]>(supabase.from('exams').update(patch).eq('id', id).select()).then((rows) => rows[0]),

  remove: (id: string) => unwrap(supabase.from('exams').delete().eq('id', id).select()),
}

// ---------------------------------------------------------------------------
// Assignments
// ---------------------------------------------------------------------------
export const assignmentsApi = {
  list: (userId: string) =>
    unwrap<Assignment[]>(supabase.from('assignments').select('*').eq('user_id', userId).order('due_date')),

  create: (userId: string, input: { subject_id: string; title: string; due_date: string; notes?: string | null }) =>
    unwrap<Assignment[]>(
      supabase
        .from('assignments')
        .insert({ user_id: userId, ...input })
        .select()
    ).then((rows) => rows[0]),

  update: (id: string, patch: Partial<Pick<Assignment, 'subject_id' | 'title' | 'due_date' | 'notes'>>) =>
    unwrap<Assignment[]>(supabase.from('assignments').update(patch).eq('id', id).select()).then((rows) => rows[0]),

  remove: (id: string) => unwrap(supabase.from('assignments').delete().eq('id', id).select()),
}

// ---------------------------------------------------------------------------
// Profile — sharing settings + cross-user free-time lookup
// ---------------------------------------------------------------------------
export const profilesApi = {
  get: (userId: string) => unwrap<Profile>(supabase.from('profiles').select('*').eq('id', userId).single()),

  update: (userId: string, patch: Partial<Pick<Profile, 'sharing_enabled'>>) =>
    unwrap<Profile[]>(supabase.from('profiles').update(patch).eq('id', userId).select()).then((rows) => rows[0]),

  /** Looks up only bare busy time blocks for a classmate's share code — no subjects, sessions, or other personal data. */
  getSharedBusyBlocks: (shareCode: string) =>
    unwrap<SharedBusyBlock[]>(supabase.rpc('get_shared_busy_blocks', { p_share_code: shareCode.trim() })),
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
const DEFAULT_SETTINGS: Omit<UserSettings, 'user_id'> = {
  day_start_minute: 420,
  day_end_minute: 1380,
  min_session_minutes: 25,
  max_session_minutes: 60,
  buffer_minutes: 10,
  daily_study_target_minutes: 120,
  preferred_study_start_minute: 900,
  preferred_study_end_minute: 1320,
  min_gap_for_study_minutes: 240,
  major: null,
  program_intensity: null,
  reminders_enabled: true,
  reminder_lead_minutes: 10,
}

export const settingsApi = {
  get: async (userId: string): Promise<UserSettings> => {
    const { data, error } = await supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle()
    if (error) throw new Error(error.message)
    if (data) return data as UserSettings
    return unwrap<UserSettings[]>(
      supabase
        .from('user_settings')
        .insert({ user_id: userId, ...DEFAULT_SETTINGS })
        .select()
    ).then((rows) => rows[0])
  },

  update: (userId: string, patch: Partial<Omit<UserSettings, 'user_id'>>) =>
    unwrap<UserSettings[]>(supabase.from('user_settings').update(patch).eq('user_id', userId).select()).then((rows) => rows[0]),
}
