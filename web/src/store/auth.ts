import { create } from "zustand";
import { persist } from "zustand/middleware";

interface TokenPair {
	accessToken: string;
	refreshToken: string;
	expiresAt: string;
}

interface AuthState {
	accessToken: string | null;
	refreshToken: string | null;
	isAuthenticated: boolean;
	login: (tokens: TokenPair) => void;
	logout: () => void;
}

export const useAuthStore = create<AuthState>()(
	persist(
		(set) => ({
			accessToken: null,
			refreshToken: null,
			isAuthenticated: false,

			login: (tokens) => {
				set({
					accessToken: tokens.accessToken,
					refreshToken: tokens.refreshToken,
					isAuthenticated: true,
				});
			},

			logout: () => {
				set({ accessToken: null, refreshToken: null, isAuthenticated: false });
			},
		}),
		{ name: "fog-auth" },
	),
);
