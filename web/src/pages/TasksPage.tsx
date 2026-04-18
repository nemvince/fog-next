import { type Host, type Image, type Task, hostsApi, imagesApi, tasksApi } from "@/api/client";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/Dialog";
import { toast } from "@/components/ui/Toast";
import { useServerEvents } from "@/hooks/useServerEvents";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	createColumnHelper,
	getCoreRowModel,
	useReactTable,
} from "@tanstack/react-table";
import { Plus, XCircle } from "lucide-react";
import { useMemo, useState } from "react";

const TASK_TYPES = [
	{ value: "deploy", label: "Deploy" },
	{ value: "capture", label: "Capture" },
	{ value: "debug_deploy", label: "Debug (Deploy)" },
	{ value: "debug_capture", label: "Debug (Capture)" },
	{ value: "multicast", label: "Multicast" },
	{ value: "wipe", label: "Disk Wipe" },
	{ value: "memtest", label: "Memory Test" },
	{ value: "disk_test", label: "Disk Test" },
] as const;

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
	const [open, setOpen] = useState(false);
	const [taskType, setTaskType] = useState("deploy");
	const [hostId, setHostId] = useState("");
	const [imageId, setImageId] = useState("");
	const [isShutdown, setIsShutdown] = useState(false);

	const stateFilter =
		tab === "active" ? "active" : tab === "queued" ? "queued" : "";

	const { data, isLoading } = useQuery({
		queryKey: ["tasks", tab],
		queryFn: () => tasksApi.list(1, 50),
		refetchInterval: 10_000,
	});

	const { data: hostsData } = useQuery({
		queryKey: ["hosts"],
		queryFn: () => hostsApi.list(),
		enabled: open,
	});

	const { data: imagesData } = useQuery({
		queryKey: ["images"],
		queryFn: () => imagesApi.list(),
		enabled: open,
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

	const createMutation = useMutation({
		mutationFn: (payload: Partial<Task>) => tasksApi.create(payload),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: ["tasks"] });
			setOpen(false);
			resetForm();
			toast("Task created", { variant: "success" });
		},
		onError: (e: Error) => toast(e.message, { variant: "destructive" }),
	});

	function resetForm() {
		setTaskType("deploy");
		setHostId("");
		setImageId("");
		setIsShutdown(false);
	}

	const needsImage = ["deploy", "capture", "multicast", "debug_deploy", "debug_capture"].includes(taskType);

	const columns = useMemo(() => [
		col.accessor("type", {
			header: "Type",
			cell: (info) => <span className="capitalize">{info.getValue().replace("_", " ")}</span>,
		}),
		col.accessor("hostId", {
			header: "Host",
			cell: (info) => <span className="font-mono text-xs">{info.getValue().slice(0, 8)}…</span>,
		}),
		col.accessor("state", {
			header: "State",
			cell: (info) => (
				<Badge variant={stateVariant(info.getValue())}>{info.getValue()}</Badge>
			),
		}),
		col.accessor("percentComplete", {
			header: "Progress",
			cell: (info) => {
				const pct = info.getValue();
				const state = info.row.original.state;
				if (state === "complete") return "100%";
				if (state !== "active" && state !== "queued") return "—";
				return (
					<div className="flex items-center gap-2">
						<div className="h-2 w-24 rounded-full bg-gray-700">
							<div
								className="h-2 rounded-full bg-blue-500 transition-all"
								style={{ width: `${Math.min(pct, 100)}%` }}
							/>
						</div>
						<span className="text-xs text-gray-400">{pct}%</span>
					</div>
				);
			},
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

	const selectClass =
		"rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500";

	return (
		<div className="p-8">
			<div className="mb-6 flex items-center justify-between">
				<h1 className="text-2xl font-bold">Tasks</h1>
				<Button onClick={() => setOpen(true)}>
					<Plus className="h-4 w-4" /> New Task
				</Button>
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

			{/* Create Task Dialog */}
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle className="text-lg font-semibold text-gray-100">
							Create Task
						</DialogTitle>
					</DialogHeader>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							if (!hostId) return;
							createMutation.mutate({
								type: taskType,
								hostId,
								...(needsImage && imageId ? { imageId } : {}),
								isShutdown,
							});
						}}
						className="flex flex-col gap-4"
					>
						<div className="flex flex-col gap-1">
							<label className="text-xs text-gray-400">Task Type</label>
							<select
								value={taskType}
								onChange={(e) => setTaskType(e.target.value)}
								className={selectClass}
							>
								{TASK_TYPES.map((t) => (
									<option key={t.value} value={t.value}>{t.label}</option>
								))}
							</select>
						</div>
						<div className="flex flex-col gap-1">
							<label className="text-xs text-gray-400">Host</label>
							<select
								value={hostId}
								onChange={(e) => setHostId(e.target.value)}
								className={selectClass}
								required
							>
								<option value="">Select a host…</option>
								{(hostsData?.data ?? []).map((h: Host) => (
									<option key={h.id} value={h.id}>{h.name} ({h.ip || "no IP"})</option>
								))}
							</select>
						</div>
						{needsImage && (
							<div className="flex flex-col gap-1">
								<label className="text-xs text-gray-400">Image (optional — defaults to host&apos;s assigned image)</label>
								<select
									value={imageId}
									onChange={(e) => setImageId(e.target.value)}
									className={selectClass}
								>
									<option value="">Use host&apos;s default image</option>
									{(imagesData?.data ?? []).map((img: Image) => (
										<option key={img.id} value={img.id}>{img.name}</option>
									))}
								</select>
							</div>
						)}
						<label className="flex items-center gap-2 cursor-pointer select-none">
							<input
								type="checkbox"
								className="h-4 w-4 accent-blue-500"
								checked={isShutdown}
								onChange={(e) => setIsShutdown(e.target.checked)}
							/>
							<span className="text-sm text-gray-300">Shutdown after completion</span>
						</label>
						<div className="flex justify-end gap-2">
							<Button type="button" variant="outline" onClick={() => setOpen(false)}>
								Cancel
							</Button>
							<Button type="submit" disabled={createMutation.isPending || !hostId}>
								Create
							</Button>
						</div>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	);
}
