import { useAuthStore } from '@/store/auth'
import { Navigate, Outlet } from 'react-router-dom'

export function RequireAuth() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <Outlet />
}
