import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { RequireAuth } from "@/components/RequireAuth";
import { ToastProvider } from "@/components/ui/Toast";
import { LoginPage } from "@/pages/LoginPage";

const DashboardPage = lazy(() =>
	import("@/pages/DashboardPage").then((m) => ({ default: m.DashboardPage })),
);
const HostsPage = lazy(() =>
	import("@/pages/HostsPage").then((m) => ({ default: m.HostsPage })),
);
const ImagesPage = lazy(() =>
	import("@/pages/ImagesPage").then((m) => ({ default: m.ImagesPage })),
);
const TasksPage = lazy(() =>
	import("@/pages/TasksPage").then((m) => ({ default: m.TasksPage })),
);
const GroupsPage = lazy(() =>
	import("@/pages/GroupsPage").then((m) => ({ default: m.GroupsPage })),
);
const SnapinsPage = lazy(() =>
	import("@/pages/SnapinsPage").then((m) => ({ default: m.SnapinsPage })),
);
const StoragePage = lazy(() =>
	import("@/pages/StoragePage").then((m) => ({ default: m.StoragePage })),
);
const UsersPage = lazy(() =>
	import("@/pages/UsersPage").then((m) => ({ default: m.UsersPage })),
);
const SettingsPage = lazy(() =>
	import("@/pages/SettingsPage").then((m) => ({ default: m.SettingsPage })),
);
const HostDetailPage = lazy(() =>
	import("@/pages/HostDetailPage").then((m) => ({ default: m.HostDetailPage })),
);

const ReportsPage = lazy(() =>
	import("@/pages/ReportsPage").then((m) => ({ default: m.ReportsPage })),
);

const queryClient = new QueryClient({
	defaultOptions: {
		queries: { staleTime: 30_000, retry: 1 },
	},
});

export function App() {
	return (
		<QueryClientProvider client={queryClient}>
			<ToastProvider>
				<BrowserRouter>
					<Suspense
						fallback={<div className="p-8 text-gray-400">Loading…</div>}
					>
						<Routes>
							<Route path="/login" element={<LoginPage />} />
							<Route element={<RequireAuth />}>
								<Route element={<AppLayout />}>
									<Route index element={<Navigate to="/dashboard" replace />} />
									<Route path="dashboard" element={<DashboardPage />} />
									<Route path="hosts" element={<HostsPage />} />
									<Route path="hosts/:id" element={<HostDetailPage />} />
									<Route path="images" element={<ImagesPage />} />
									<Route path="tasks" element={<TasksPage />} />
									<Route path="groups" element={<GroupsPage />} />
									<Route path="snapins" element={<SnapinsPage />} />
									<Route path="storage" element={<StoragePage />} />
									<Route path="users" element={<UsersPage />} />
									<Route path="settings" element={<SettingsPage />} />
									<Route path="reports" element={<ReportsPage />} />
								</Route>
							</Route>
						</Routes>
					</Suspense>
				</BrowserRouter>
			</ToastProvider>
		</QueryClientProvider>
	);
}

export default App;
