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
	expiresAt: string | null;
	isAuthenticated: boolean;
	login: (tokens: TokenPair) => void;
	logout: () => void;
}

export const useAuthStore = create<AuthState>()(
	persist(
		(set) => ({
			accessToken: null,
			refreshToken: null,
			expiresAt: null,
			isAuthenticated: false,

			login: (tokens) => {
				set({
					accessToken: tokens.accessToken,
					refreshToken: tokens.refreshToken,
					expiresAt: tokens.expiresAt,
					isAuthenticated: true,
				});
			},

			logout: () => {
				set({
					accessToken: null,
					refreshToken: null,
					expiresAt: null,
					isAuthenticated: false,
				});
			},
		}),
		{ name: "fog-auth" },
	),
);

/** Returns true when the stored access token is absent or past its expiry. */
export function isTokenExpired(): boolean {
	const { expiresAt } = useAuthStore.getState();
	if (!expiresAt) return true;
	// Treat tokens expiring within the next 10 seconds as already expired.
	return new Date(expiresAt).getTime() - 10_000 <= Date.now();
}
