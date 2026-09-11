import { useEffect, useRef } from 'react'
import { format, startOfWeek } from 'date-fns'
import { useAuth } from './AuthContext'
import { useSettings, useSubjects, useWeekSessions } from './hooks'
import { notify } from './notifications'

/** Polls the current week's planned sessions and fires a browser notification shortly before each one starts. */
export function useReminders() {
  const { user } = useAuth()
  const { settings } = useSettings()
  const { subjects } = useSubjects()
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const { sessions } = useWeekSessions(weekStart)
  const notifiedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!user || !settings?.reminders_enabled) return

    const check = () => {
      const now = new Date()
      const nowMinute = now.getHours() * 60 + now.getMinutes()

      for (const session of sessions) {
        if (session.status !== 'planned') continue
        // DayOfWeek is 0=Sunday..6=Saturday, matching Date#getDay().
        if (session.day_of_week !== now.getDay()) continue

        const leadStart = session.start_minute - settings.reminder_lead_minutes
        if (nowMinute >= leadStart && nowMinute < session.start_minute && !notifiedRef.current.has(session.id)) {
          const subject = subjects.find((s) => s.id === session.subject_id)
          const minutesAway = session.start_minute - nowMinute
          if (session.is_review) {
            notify('Review time is near', `Quick ${subject?.name ?? 'subject'} review before class — starts in ${minutesAway} min`)
          } else {
            notify('Study session starting soon', `${subject?.name ?? 'Study time'} in ${minutesAway} min`)
          }
          notifiedRef.current.add(session.id)
        }
      }
    }

    check()
    const interval = setInterval(check, 30_000)
    return () => clearInterval(interval)
  }, [user, settings, subjects, sessions])
}
