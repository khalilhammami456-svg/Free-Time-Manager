import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

const NAV_ITEMS = [
  { to: '/', label: 'Planner', icon: '📅' },
  { to: '/timetable', label: 'Timetable', icon: '🗓️' },
  { to: '/subjects', label: 'Subjects', icon: '📚' },
  { to: '/exams', label: 'Exams', icon: '📝' },
  { to: '/assignments', label: 'Assignments', icon: '📌' },
  { to: '/compare', label: 'Compare', icon: '🤝' },
  { to: '/stats', label: 'Progress', icon: '📊' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
]

export default function Layout() {
  const { user, signOut } = useAuth()

  return (
    <div className="min-h-screen pb-16 md:pb-0 md:pl-56">
      <aside className="hidden md:fixed md:inset-y-0 md:left-0 md:flex md:w-56 md:flex-col md:border-r md:border-slate-800 md:bg-slate-900/60 md:px-4 md:py-6">
        <div className="mb-8 flex items-center gap-2 px-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-lg">⏱️</span>
          <span className="text-sm font-semibold text-white">Free Time Manager</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive ? 'bg-brand-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-800 pt-4">
          <p className="truncate px-2 text-xs text-slate-500">{user?.email}</p>
          <button
            onClick={signOut}
            className="mt-2 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-8">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-slate-800 bg-slate-900/95 backdrop-blur md:hidden">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
                isActive ? 'text-brand-400' : 'text-slate-500'
              }`
            }
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
