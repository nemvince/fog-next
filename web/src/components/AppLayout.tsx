import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import {
    BarChart2,
    HardDrive,
    ListTodo,
    LogOut,
    Monitor,
    Package,
    Server,
    Settings,
    Users,
} from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: Monitor },
  { to: '/hosts', label: 'Hosts', icon: Server },
  { to: '/images', label: 'Images', icon: HardDrive },
  { to: '/tasks', label: 'Tasks', icon: ListTodo },
  { to: '/groups', label: 'Groups', icon: Users },
  { to: '/snapins', label: 'Snapins', icon: Package },
  { to: '/reports', label: 'Reports', icon: BarChart2 },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function AppLayout() {
  const logout = useAuthStore((s) => s.logout)

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100">
      {/* Sidebar */}
      <aside className="flex w-56 flex-col border-r border-gray-800 bg-gray-900">
        <div className="flex h-14 items-center px-4 font-bold text-blue-400 text-lg tracking-wide">
          FOG
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-2">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100',
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <button
          onClick={logout}
          className="flex items-center gap-3 px-5 py-4 text-sm text-gray-500 hover:text-red-400 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </aside>

      {/* Main */}
      <main className="flex flex-1 flex-col overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
