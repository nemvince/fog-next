import { useQuery } from "@tanstack/react-query";
import { hostsApi, imagesApi, tasksApi } from "@/api/client";

export function DashboardPage() {
	const { data: hosts } = useQuery({
		queryKey: ["hosts", 1],
		queryFn: () => hostsApi.list(1, 1),
	});
	const { data: images } = useQuery({
		queryKey: ["images", 1],
		queryFn: () => imagesApi.list(1, 1),
	});
	const { data: tasks } = useQuery({
		queryKey: ["tasks", 1],
		queryFn: () => tasksApi.list(1, 1),
	});

	const stats = [
		{ label: "Hosts", value: hosts?.total ?? "–" },
		{ label: "Images", value: images?.total ?? "–" },
		{ label: "Active Tasks", value: tasks?.total ?? "–" },
	];

	return (
		<div className="p-8">
			<h1 className="mb-6 text-2xl font-bold">Dashboard</h1>
			<div className="grid grid-cols-3 gap-4">
				{stats.map(({ label, value }) => (
					<div
						key={label}
						className="rounded-xl border border-gray-800 bg-gray-900 p-6 text-center"
					>
						<p className="text-3xl font-bold text-blue-400">{value}</p>
						<p className="mt-1 text-sm text-gray-400">{label}</p>
					</div>
				))}
			</div>
		</div>
	);
}
