import { useCallback, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'
import { settingsApi, subjectsApi, timetableApi, sessionsApi, examsApi, assignmentsApi, profilesApi } from './api'
import type { Assignment, Difficulty, Exam, Profile, StudySession, Subject, TimetableEntry, UserSettings } from '../types'

export function useSubjects() {
  const { user } = useAuth()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      setSubjects(await subjectsApi.list(user.id))
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    reload()
  }, [reload])

  const create = async (input: { name: string; color: string; difficulty: Difficulty; weekly_target_minutes?: number | null }) => {
    if (!user) return
    const subject = await subjectsApi.create(user.id, input)
    setSubjects((prev) => [...prev, subject])
    return subject
  }

  const update = async (id: string, patch: Partial<Pick<Subject, 'name' | 'color' | 'difficulty' | 'weekly_target_minutes'>>) => {
    const updated = await subjectsApi.update(id, patch)
    setSubjects((prev) => prev.map((s) => (s.id === id ? updated : s)))
    return updated
  }

  const remove = async (id: string) => {
    await subjectsApi.remove(id)
    setSubjects((prev) => prev.filter((s) => s.id !== id))
  }

  return { subjects, loading, create, update, remove, reload }
}

export function useTimetable() {
  const { user } = useAuth()
  const [entries, setEntries] = useState<TimetableEntry[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      setEntries(await timetableApi.list(user.id))
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    reload()
  }, [reload])

  const create = async (input: Parameters<typeof timetableApi.create>[1]) => {
    if (!user) return
    const entry = await timetableApi.create(user.id, input)
    setEntries((prev) => [...prev, entry])
    return entry
  }

  const createMany = async (inputs: Parameters<typeof timetableApi.createMany>[1]) => {
    if (!user) return
    const created = await timetableApi.createMany(user.id, inputs)
    setEntries((prev) => [...prev, ...created])
    return created
  }

  const update = async (id: string, patch: Parameters<typeof timetableApi.update>[1]) => {
    const updated = await timetableApi.update(id, patch)
    setEntries((prev) => prev.map((e) => (e.id === id ? updated : e)))
    return updated
  }

  const remove = async (id: string) => {
    await timetableApi.remove(id)
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  return { entries, loading, create, createMany, update, remove, reload }
}

export function useSettings() {
  const { user } = useAuth()
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      setSettings(await settingsApi.get(user.id))
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    reload()
  }, [reload])

  const update = async (patch: Partial<Omit<UserSettings, 'user_id'>>) => {
    if (!user) return
    const updated = await settingsApi.update(user.id, patch)
    setSettings(updated)
    return updated
  }

  return { settings, loading, update, reload }
}

export function useExams() {
  const { user } = useAuth()
  const [exams, setExams] = useState<Exam[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      setExams(await examsApi.list(user.id))
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    reload()
  }, [reload])

  const create = async (input: Parameters<typeof examsApi.create>[1]) => {
    if (!user) return
    const exam = await examsApi.create(user.id, input)
    setExams((prev) => [...prev, exam].sort((a, b) => a.exam_date.localeCompare(b.exam_date)))
    return exam
  }

  const update = async (id: string, patch: Parameters<typeof examsApi.update>[1]) => {
    const updated = await examsApi.update(id, patch)
    setExams((prev) => prev.map((e) => (e.id === id ? updated : e)))
    return updated
  }

  const remove = async (id: string) => {
    await examsApi.remove(id)
    setExams((prev) => prev.filter((e) => e.id !== id))
  }

  return { exams, loading, create, update, remove, reload }
}

export function useAssignments() {
  const { user } = useAuth()
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      setAssignments(await assignmentsApi.list(user.id))
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    reload()
  }, [reload])

  const create = async (input: Parameters<typeof assignmentsApi.create>[1]) => {
    if (!user) return
    const assignment = await assignmentsApi.create(user.id, input)
    setAssignments((prev) => [...prev, assignment].sort((a, b) => a.due_date.localeCompare(b.due_date)))
    return assignment
  }

  const update = async (id: string, patch: Parameters<typeof assignmentsApi.update>[1]) => {
    const updated = await assignmentsApi.update(id, patch)
    setAssignments((prev) => prev.map((a) => (a.id === id ? updated : a)))
    return updated
  }

  const remove = async (id: string) => {
    await assignmentsApi.remove(id)
    setAssignments((prev) => prev.filter((a) => a.id !== id))
  }

  return { assignments, loading, create, update, remove, reload }
}

export function useProfile() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      setProfile(await profilesApi.get(user.id))
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    reload()
  }, [reload])

  const update = async (patch: Parameters<typeof profilesApi.update>[1]) => {
    if (!user) return
    const updated = await profilesApi.update(user.id, patch)
    setProfile(updated)
    return updated
  }

  return { profile, loading, update, reload }
}

export function useWeekSessions(weekStart: string) {
  const { user } = useAuth()
  const [sessions, setSessions] = useState<StudySession[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      setSessions(await sessionsApi.listForWeek(user.id, weekStart))
    } finally {
      setLoading(false)
    }
  }, [user, weekStart])

  useEffect(() => {
    reload()
  }, [reload])

  return { sessions, setSessions, loading, reload }
}
