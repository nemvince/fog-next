import { type Task, tasksApi } from "@/api/client";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { toast } from "@/components/ui/Toast";
import { useServerEvents } from "@/hooks/useServerEvents";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	createColumnHelper,
	getCoreRowModel,
	useReactTable,
} from "@tanstack/react-table";
import { XCircle } from "lucide-react";
import { useMemo, useState } from "react";

const stateVariant = (
	state: string,
): "default" | "success" | "warning" | "destructive" | "outline" => {
	switch (state) {
		case "active":
			return "warning";
		case "complete":
			return "success";
		case "failed":
			return "destructive";
		case "canceled":
			return "outline";
		default:
			return "default";
	}
};

const col = createColumnHelper<Task>();

export function TasksPage() {
	useServerEvents();
	const qc = useQueryClient();
	const [tab, setTab] = useState<"active" | "queued" | "history">("active");

	const stateFilter =
		tab === "active" ? "active" : tab === "queued" ? "queued" : "";

	const { data, isLoading } = useQuery({
		queryKey: ["tasks", tab],
		queryFn: () => tasksApi.list(1, 50),
		refetchInterval: 10_000,
	});

	const filtered = (data?.data ?? []).filter((t) =>
		tab === "history"
			? ["complete", "failed", "canceled"].includes(t.state)
			: t.state === stateFilter,
	);

	const cancelMutation = useMutation({
		mutationFn: (id: string) => tasksApi.cancel(id),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: ["tasks"] });
			toast("Task canceled");
		},
		onError: (e: Error) => toast(e.message, { variant: "destructive" }),
	});

	const columns = useMemo(() => [
		col.accessor("type", { header: "Type" }),
		col.accessor("hostId", { header: "Host ID" }),
		col.accessor("state", {
			header: "State",
			cell: (info) => (
				<Badge variant={stateVariant(info.getValue())}>{info.getValue()}</Badge>
			),
		}),
		col.accessor("createdAt", {
			header: "Created",
			cell: (info) => new Date(info.getValue()).toLocaleString(),
		}),
		col.display({
			id: "actions",
			cell: (info) =>
				["active", "queued"].includes(info.row.original.state) ? (
					<Button
						variant="ghost"
						size="icon"
						onClick={() => cancelMutation.mutate(info.row.original.id)}
					>
						<XCircle className="h-4 w-4 text-red-400" />
					</Button>
				) : null,
		}),
	], [cancelMutation.mutate]);

	const table = useReactTable({
		data: filtered,
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	return (
		<div className="p-8">
			<div className="mb-6 flex items-center justify-between">
				<h1 className="text-2xl font-bold">Tasks</h1>
			</div>

			{/* Tabs */}
			<div className="mb-4 flex gap-1 rounded-lg bg-gray-800 p-1 w-fit">
				{(["active", "queued", "history"] as const).map((t) => (
					<button
						type="button"
						key={t}
						onClick={() => setTab(t)}
						className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
							tab === t
								? "bg-gray-700 text-gray-100"
								: "text-gray-400 hover:text-gray-200"
						}`}
					>
						{t}
					</button>
				))}
			</div>

			<DataTable
				table={table}
				isLoading={isLoading}
				emptyMessage={`No ${tab} tasks`}
			/>
		</div>
	);
}
