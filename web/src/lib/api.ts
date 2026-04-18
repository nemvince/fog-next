import { useAuthStore } from "@/store/auth";

const BASE = "/fog/api/v1";

export class ApiError extends Error {
	status: number;
	constructor(status: number, message: string) {
		super(message);
		this.name = "ApiError";
		this.status = status;
	}
}

async function request<T>(
	method: string,
	path: string,
	body?: unknown,
): Promise<T> {
	const token = useAuthStore.getState().accessToken;
	const res = await fetch(`${BASE}${path}`, {
		method,
		headers: {
			"Content-Type": "application/json",
			...(token ? { Authorization: `Bearer ${token}` } : {}),
		},
		body: body !== undefined ? JSON.stringify(body) : undefined,
	});

	if (!res.ok) {
		const text = await res.text().catch(() => res.statusText);
		throw new ApiError(res.status, text || res.statusText);
	}

	if (res.status === 204) return undefined as T;
	return res.json() as Promise<T>;
}

async function upload<T>(path: string, formData: FormData): Promise<T> {
	const token = useAuthStore.getState().accessToken;
	const res = await fetch(`${BASE}${path}`, {
		method: "POST",
		headers: token ? { Authorization: `Bearer ${token}` } : {},
		body: formData,
	});

	if (!res.ok) {
		const text = await res.text().catch(() => res.statusText);
		throw new ApiError(res.status, text || res.statusText);
	}

	if (res.status === 204) return undefined as T;
	return res.json() as Promise<T>;
}

export const api = {
	get: <T>(path: string) => request<T>("GET", path),
	post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
	put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
	patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
	del: <T>(path: string) => request<T>("DELETE", path),
	upload: <T>(path: string, formData: FormData) => upload<T>(path, formData),
};
