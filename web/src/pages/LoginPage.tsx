import type React from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth";

export function LoginPage() {
	const login = useAuthStore((s) => s.login);
	const navigate = useNavigate();
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError("");
		setLoading(true);
		try {
			await login(username, password);
			navigate("/dashboard");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Login failed");
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-gray-950">
			<form
				onSubmit={handleSubmit}
				className="w-full max-w-sm rounded-xl border border-gray-800 bg-gray-900 p-8 shadow-2xl"
			>
				<h1 className="mb-6 text-center text-2xl font-bold text-blue-400">
					FOG
				</h1>
				{error && (
					<p className="mb-4 rounded-md bg-red-900/50 px-3 py-2 text-sm text-red-300">
						{error}
					</p>
				)}
				<div className="mb-4 flex flex-col gap-1">
					<label className="text-xs text-gray-400" htmlFor="username-input">
						Username
					</label>
					<input
						id="username-input"
						type="text"
						value={username}
						onChange={(e) => setUsername(e.target.value)}
						required
						autoComplete="username"
						className="rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 outline-none focus:border-blue-500"
					/>
				</div>
				<div className="mb-6 flex flex-col gap-1">
					<label className="text-xs text-gray-400" htmlFor="password-input">
						Password
					</label>
					<input
						id="password-input"
						type="password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						required
						autoComplete="current-password"
						className="rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 outline-none focus:border-blue-500"
					/>
				</div>
				<button
					type="submit"
					disabled={loading}
					className="w-full rounded-md bg-blue-600 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
				>
					{loading ? "Signing in…" : "Sign in"}
				</button>
			</form>
		</div>
	);
}
