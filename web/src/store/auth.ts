import { authApi } from '@/api/client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      login: async (username, password) => {
        const { accessToken, refreshToken } = await authApi.login(username, password)
        localStorage.setItem('fog_token', accessToken)
        set({ accessToken, refreshToken, isAuthenticated: true })
      },

      logout: () => {
        localStorage.removeItem('fog_token')
        set({ accessToken: null, refreshToken: null, isAuthenticated: false })
      },
    }),
    { name: 'fog-auth' },
  ),
)
