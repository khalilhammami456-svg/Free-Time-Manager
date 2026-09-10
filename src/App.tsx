import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import AuthPage from './pages/AuthPage'
import { useReminders } from './lib/useReminders'

const PlannerPage = lazy(() => import('./pages/PlannerPage'))
const TimetablePage = lazy(() => import('./pages/TimetablePage'))
const SubjectsPage = lazy(() => import('./pages/SubjectsPage'))
const StatsPage = lazy(() => import('./pages/StatsPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))

function ReminderWatcher() {
  useReminders()
  return null
}

function PageFallback() {
  return <div className="py-12 text-center text-sm text-slate-500">Loading…</div>
}

export default function App() {
  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route
            index
            element={
              <Suspense fallback={<PageFallback />}>
                <ReminderWatcher />
                <PlannerPage />
              </Suspense>
            }
          />
          <Route
            path="/timetable"
            element={
              <Suspense fallback={<PageFallback />}>
                <TimetablePage />
              </Suspense>
            }
          />
          <Route
            path="/subjects"
            element={
              <Suspense fallback={<PageFallback />}>
                <SubjectsPage />
              </Suspense>
            }
          />
          <Route
            path="/stats"
            element={
              <Suspense fallback={<PageFallback />}>
                <StatsPage />
              </Suspense>
            }
          />
          <Route
            path="/settings"
            element={
              <Suspense fallback={<PageFallback />}>
                <SettingsPage />
              </Suspense>
            }
          />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
