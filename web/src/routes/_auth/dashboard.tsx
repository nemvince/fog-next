import { Cpu, HardDrive, ListChecks } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import type { Host, Image, Paginated, Task } from "@/types";

export const Route = createFileRoute("/_auth/dashboard")({
	component: DashboardPage,
});

function StatCard({
	title,
	description,
	value,
	icon: Icon,
	isLoading,
}: {
	title: string;
	description: string;
	value: number | undefined;
	icon: React.ElementType;
	isLoading: boolean;
}) {
	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between pb-2">
				<CardTitle className="text-sm font-medium">{title}</CardTitle>
				<Icon className="size-4 text-muted-foreground" />
			</CardHeader>
			<CardContent>
				{isLoading ? (
					<Skeleton className="h-8 w-16" />
				) : (
					<div className="text-2xl font-bold">{value ?? 0}</div>
				)}
				<CardDescription>{description}</CardDescription>
			</CardContent>
		</Card>
	);
}

function DashboardPage() {
	const hostsQuery = useQuery({
		queryKey: ["hosts", 1, 1],
		queryFn: () => api.get<Paginated<Host>>("/hosts?page=1&limit=1"),
	});

	const imagesQuery = useQuery({
		queryKey: ["images", 1, 1],
		queryFn: () => api.get<Paginated<Image>>("/images?page=1&limit=1"),
	});

	const activeTasksQuery = useQuery({
		queryKey: ["tasks", "active"],
		queryFn: () => api.get<Paginated<Task>>("/tasks?state=active&limit=1"),
	});

	return (
		<div className="flex flex-col gap-6">
			<div>
				<h1 className="text-2xl font-bold">Dashboard</h1>
				<p className="text-muted-foreground">
					Overview of your FOG environment
				</p>
			</div>

			<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
				<StatCard
					title="Total Hosts"
					description="Registered managed hosts"
					value={hostsQuery.data?.total}
					icon={Cpu}
					isLoading={hostsQuery.isLoading}
				/>
				<StatCard
					title="Disk Images"
					description="Available deployment images"
					value={imagesQuery.data?.total}
					icon={HardDrive}
					isLoading={imagesQuery.isLoading}
				/>
				<StatCard
					title="Active Tasks"
					description="Currently running tasks"
					value={activeTasksQuery.data?.total}
					icon={ListChecks}
					isLoading={activeTasksQuery.isLoading}
				/>
			</div>
		</div>
	);
}
