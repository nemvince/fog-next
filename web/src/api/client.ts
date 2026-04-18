// Thin wrapper around fetch for the FOG API.
const BASE = "/fog";

async function request<T>(
	method: string,
	path: string,
	body?: unknown,
): Promise<T> {
	const token = localStorage.getItem("fog_token");
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
		throw new Error(text || res.statusText);
	}

	if (res.status === 204) return undefined as T;
	return res.json() as Promise<T>;
}

export const api = {
	get: <T>(path: string) => request<T>("GET", path),
	post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
	put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
	patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
	delete: <T>(path: string) => request<T>("DELETE", path),
};

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface LoginResponse {
	accessToken: string;
	refreshToken: string;
	expiresAt: string;
}

export const authApi = {
	login: (username: string, password: string) =>
		api.post<LoginResponse>("/api/v1/auth/login", { username, password }),
	refresh: (refreshToken: string) =>
		api.post<LoginResponse>("/api/v1/auth/refresh", { refreshToken }),
};

// ─── Hosts ───────────────────────────────────────────────────────────────────

export interface Host {
	id: string;
	name: string;
	description: string;
	ip: string;
	imageId?: string;
	kernel: string;
	init: string;
	kernelArgs: string;
	isEnabled: boolean;
	useAad: boolean;
	useWol: boolean;
	lastContact?: string;
	deployedAt?: string;
	createdAt: string;
	updatedAt: string;
	macs?: HostMAC[];
}

export interface HostMAC {
	id: string;
	hostId: string;
	mac: string;
	description: string;
	isPrimary: boolean;
	isIgnored: boolean;
	createdAt: string;
}

export interface Inventory {
	id: string;
	hostId: string;
	cpuModel: string;
	cpuCores: number;
	cpuFreqMhz: number;
	ramMib: number;
	hdModel: string;
	hdSizeGb: number;
	manufacturer: string;
	product: string;
	serial: string;
	uuid: string;
	biosVersion: string;
	primaryMac: string;
	osName: string;
	osVersion: string;
	createdAt: string;
	updatedAt: string;
}

export const hostsApi = {
	list: (page = 1, limit = 25) =>
		api.get<{ data: Host[] }>(
			`/api/v1/hosts?page=${page}&limit=${limit}`,
		),
	get: (id: string) => api.get<Host>(`/api/v1/hosts/${id}`),
	create: (host: Partial<Host>) => api.post<Host>("/api/v1/hosts", host),
	update: (id: string, host: Partial<Host>) =>
		api.put<Host>(`/api/v1/hosts/${id}`, host),
	delete: (id: string) => api.delete<void>(`/api/v1/hosts/${id}`),
	listMACs: (id: string) =>
		api.get<{ data: HostMAC[] }>(`/api/v1/hosts/${id}/macs`),
	addMAC: (id: string, mac: string, description = "") =>
		api.post<HostMAC>(`/api/v1/hosts/${id}/macs`, { mac, description }),
	deleteMAC: (hostId: string, macId: string) =>
		api.delete<void>(`/api/v1/hosts/${hostId}/macs/${macId}`),
	getInventory: (id: string) =>
		api.get<Inventory>(`/api/v1/hosts/${id}/inventory`),
	getActiveTask: (id: string) =>
		api.get<Task | null>(`/api/v1/hosts/${id}/task`),
};

// ─── Images ──────────────────────────────────────────────────────────────────

export interface Image {
	id: string;
	name: string;
	description: string;
	path: string;
	osTypeId?: string;
	imageTypeId?: string;
	storageGroupId?: string;
	isEnabled: boolean;
	toReplicate: boolean;
	sizeBytes: number;
	partitions?: unknown;
	createdAt: string;
	createdBy: string;
	updatedAt: string;
}

export const imagesApi = {
	list: (page = 1, limit = 25) =>
		api.get<{ data: Image[] }>(
			`/api/v1/images?page=${page}&limit=${limit}`,
		),
	get: (id: string) => api.get<Image>(`/api/v1/images/${id}`),
	create: (img: Partial<Image>) => api.post<Image>("/api/v1/images", img),
	update: (id: string, img: Partial<Image>) =>
		api.put<Image>(`/api/v1/images/${id}`, img),
	delete: (id: string) => api.delete<void>(`/api/v1/images/${id}`),
};

// ─── Tasks ───────────────────────────────────────────────────────────────────

export interface Task {
	id: string;
	name: string;
	type: string;
	state: string;
	hostId: string;
	imageId?: string;
	storageNodeId?: string;
	storageGroupId?: string;
	isGroup: boolean;
	isForced: boolean;
	isShutdown: boolean;
	percentComplete: number;
	bitsPerMinute: number;
	bytesTransferred: number;
	scheduledAt?: string;
	startedAt?: string;
	completedAt?: string;
	createdAt: string;
	createdBy: string;
	updatedAt: string;
}

export const tasksApi = {
	list: (page = 1, limit = 25) =>
		api.get<{ data: Task[] }>(
			`/api/v1/tasks?page=${page}&limit=${limit}`,
		),
	create: (task: Partial<Task>) => api.post<Task>("/api/v1/tasks", task),
	cancel: (id: string) => api.delete<void>(`/api/v1/tasks/${id}`),
};

// ─── Groups ──────────────────────────────────────────────────────────────────

export interface Group {
	id: string;
	name: string;
	description: string;
	createdAt: string;
	createdBy: string;
	updatedAt: string;
	hostCount?: number;
}

export interface GroupMember {
	id: string;
	groupId: string;
	hostId: string;
}

export const groupsApi = {
	list: () => api.get<{ data: Group[] }>("/api/v1/groups"),
	get: (id: string) => api.get<Group>(`/api/v1/groups/${id}`),
	create: (g: Partial<Group>) => api.post<Group>("/api/v1/groups", g),
	update: (id: string, g: Partial<Group>) =>
		api.put<Group>(`/api/v1/groups/${id}`, g),
	delete: (id: string) => api.delete<void>(`/api/v1/groups/${id}`),
	listMembers: (id: string) =>
		api.get<{ data: GroupMember[] }>(`/api/v1/groups/${id}/members`),
	addMember: (id: string, hostId: string) =>
		api.post<void>(`/api/v1/groups/${id}/members`, { hostId }),
	removeMember: (id: string, hostId: string) =>
		api.delete<void>(`/api/v1/groups/${id}/members/${hostId}`),
};

// ─── Snapins ─────────────────────────────────────────────────────────────────

export interface Snapin {
	id: string;
	name: string;
	description: string;
	fileName: string;
	filePath: string;
	command: string;
	arguments: string;
	runWith: string;
	hash: string;
	sizeBytes: number;
	isEnabled: boolean;
	toReplicate: boolean;
	createdAt: string;
	createdBy: string;
	updatedAt: string;
}

export const snapinsApi = {
	list: () => api.get<{ data: Snapin[] }>("/api/v1/snapins"),
	get: (id: string) => api.get<Snapin>(`/api/v1/snapins/${id}`),
	create: (s: Partial<Snapin>) => api.post<Snapin>("/api/v1/snapins", s),
	update: (id: string, s: Partial<Snapin>) =>
		api.put<Snapin>(`/api/v1/snapins/${id}`, s),
	delete: (id: string) => api.delete<void>(`/api/v1/snapins/${id}`),
};

// ─── Storage ─────────────────────────────────────────────────────────────────

export interface StorageGroup {
	id: string;
	name: string;
	description: string;
	createdAt: string;
	updatedAt: string;
}

export interface StorageNode {
	id: string;
	name: string;
	description: string;
	storageGroupId: string;
	hostname: string;
	rootPath: string;
	isEnabled: boolean;
	isMaster: boolean;
	maxClients: number;
	sshUser: string;
	webRoot: string;
	createdAt: string;
	updatedAt: string;
}

export const storageApi = {
	listGroups: () => api.get<{ data: StorageGroup[] }>("/api/v1/storage/groups"),
	createGroup: (g: Partial<StorageGroup>) =>
		api.post<StorageGroup>("/api/v1/storage/groups", g),
	deleteGroup: (id: string) => api.delete<void>(`/api/v1/storage/groups/${id}`),
	listNodes: (groupId: string) =>
		api.get<{ data: StorageNode[] }>(`/api/v1/storage/groups/${groupId}/nodes`),
	createNode: (groupId: string, n: Partial<StorageNode>) =>
		api.post<StorageNode>(`/api/v1/storage/groups/${groupId}/nodes`, n),
	deleteNode: (id: string) => api.delete<void>(`/api/v1/storage/nodes/${id}`),
};

// ─── Users ───────────────────────────────────────────────────────────────────

export interface User {
	id: string;
	username: string;
	role: string;
	email: string;
	isActive: boolean;
	createdAt: string;
	createdBy: string;
	updatedAt: string;
	lastLoginAt?: string;
}

export const usersApi = {
	list: () => api.get<{ data: User[] }>("/api/v1/users"),
	create: (u: Partial<User> & { password: string }) =>
		api.post<User>("/api/v1/users", u),
	update: (id: string, u: Partial<User>) =>
		api.put<User>(`/api/v1/users/${id}`, u),
	delete: (id: string) => api.delete<void>(`/api/v1/users/${id}`),
	regenerateToken: (id: string) =>
		api.post<{ token: string }>(`/api/v1/users/${id}/regenerate-token`),
};

// ─── Reports ────────────────────────────────────────────────────────────────

export interface ImagingLogEntry {
	id: string;
	hostId: string;
	taskId: string;
	taskType: string;
	imageId?: string;
	sizeBytes: number;
	duration: number;
	createdAt: string;
}

export const reportsApi = {
	imagingHistory: (page = 1, limit = 50) =>
		api.get<{ data: ImagingLogEntry[] }>(
			`/api/v1/reports/imaging?page=${page}&limit=${limit}`,
		),
	hostInventory: (page = 1, limit = 50) =>
		api.get<{ data: (Host & { inventory: Inventory })[] }>(
			`/api/v1/reports/inventory?page=${page}&limit=${limit}`,
		),
};

// ─── Settings ────────────────────────────────────────────────────────────────

export interface Setting {
	key: string;
	value: string;
	category: string;
	description: string;
}

export const settingsApi = {
	list: (category?: string) =>
		api.get<{ data: Setting[] }>(
			`/api/v1/settings${category ? `?category=${category}` : ""}`,
		),
	set: (key: string, value: string) =>
		api.put<void>(`/api/v1/settings/${key}`, { value }),
};
