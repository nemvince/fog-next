import { authApi } from '@/api/client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  token: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      isAuthenticated: false,

      login: async (username, password) => {
        const { token, refreshToken } = await authApi.login(username, password)
        localStorage.setItem('fog_token', token)
        set({ token, refreshToken, isAuthenticated: true })
      },

      logout: () => {
        localStorage.removeItem('fog_token')
        set({ token: null, refreshToken: null, isAuthenticated: false })
      },
    }),
    { name: 'fog-auth' },
  ),
)
