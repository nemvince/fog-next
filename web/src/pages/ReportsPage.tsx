import { useQuery } from "@tanstack/react-query";
import {
	createColumnHelper,
	flexRender,
	getCoreRowModel,
	useReactTable,
} from "@tanstack/react-table";
import { useState } from "react";
import { type ImagingLogEntry, reportsApi } from "@/api/client";

const col = createColumnHelper<ImagingLogEntry>();

function fmtBytes(b: number) {
	if (!b) return "—";
	const gb = b / 1_073_741_824;
	return gb >= 1 ? `${gb.toFixed(2)} GiB` : `${(b / 1_048_576).toFixed(1)} MiB`;
}

function fmtDuration(seconds: number) {
	if (!seconds) return "—";
	const m = Math.floor(seconds / 60);
	const s = seconds % 60;
	return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

const columns = [
	col.accessor("hostId", { header: "Host ID" }),
	col.accessor("taskType", { header: "Type" }),
	col.accessor("imageId", {
		header: "Image ID",
		cell: (info) => info.getValue() ?? "—",
	}),
	col.accessor("sizeBytes", {
		header: "Size",
		cell: (info) => fmtBytes(info.getValue()),
	}),
	col.accessor("duration", {
		header: "Duration",
		cell: (info) => fmtDuration(info.getValue()),
	}),
	col.accessor("createdAt", {
		header: "Date",
		cell: (info) => new Date(info.getValue()).toLocaleString(),
	}),
];

type ReportTab = "imaging" | "inventory";

export function ReportsPage() {
	const [tab, setTab] = useState<ReportTab>("imaging");

	const imagingQuery = useQuery({
		queryKey: ["reports", "imaging"],
		queryFn: () => reportsApi.imagingHistory(),
		enabled: tab === "imaging",
	});

	const inventoryQuery = useQuery({
		queryKey: ["reports", "inventory"],
		queryFn: () => reportsApi.hostInventory(),
		enabled: tab === "inventory",
	});

	const imagingTable = useReactTable({
		data: (imagingQuery.data?.data ?? []) as ImagingLogEntry[],
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	function exportCSV(rows: ImagingLogEntry[]) {
		const headers = [
			"Host ID",
			"Type",
			"Image ID",
			"Size (bytes)",
			"Duration (s)",
			"Date",
		];
		const lines = rows.map((r) =>
			[
				r.hostId,
				r.taskType,
				r.imageId ?? "",
				r.sizeBytes,
				r.duration,
				r.createdAt,
			]
				.map((v) => `"${String(v).replace(/"/g, '""')}"`)
				.join(","),
		);
		const blob = new Blob([[headers.join(","), ...lines].join("\n")], {
			type: "text/csv;charset=utf-8;",
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = "fog-imaging-history.csv";
		a.click();
		URL.revokeObjectURL(url);
	}

	return (
		<div className="p-8">
			<div className="mb-6 flex items-center justify-between">
				<h1 className="text-2xl font-bold">Reports</h1>
				{tab === "imaging" && imagingQuery.data && (
					<button
						type="button"
						onClick={() =>
							exportCSV(imagingQuery.data?.data as ImagingLogEntry[])
						}
						className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
					>
						Export CSV
					</button>
				)}
			</div>

			{/* Tabs */}
			<div className="mb-6 flex gap-2 border-b border-gray-800">
				{(["imaging", "inventory"] as ReportTab[]).map((t) => (
					<button
						type="button"
						key={t}
						onClick={() => setTab(t)}
						className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
							tab === t
								? "border-b-2 border-blue-500 text-blue-400"
								: "text-gray-500 hover:text-gray-300"
						}`}
					>
						{t === "imaging" ? "Imaging History" : "Host Inventory"}
					</button>
				))}
			</div>

			{tab === "imaging" && (
				<>
					{imagingQuery.isLoading && (
						<div className="text-gray-400">Loading…</div>
					)}
					{imagingQuery.error && (
						<div className="text-red-400">Error loading imaging history</div>
					)}
					{!imagingQuery.isLoading && !imagingQuery.error && (
						<div className="overflow-hidden rounded-xl border border-gray-800">
							<table className="w-full text-sm">
								<thead className="bg-gray-800 text-gray-400">
									{imagingTable.getHeaderGroups().map((hg) => (
										<tr key={hg.id}>
											{hg.headers.map((h) => (
												<th
													key={h.id}
													className="px-4 py-3 text-left font-medium"
												>
													{flexRender(
														h.column.columnDef.header,
														h.getContext(),
													)}
												</th>
											))}
										</tr>
									))}
								</thead>
								<tbody className="divide-y divide-gray-800 bg-gray-900">
									{imagingTable.getRowModel().rows.length === 0 ? (
										<tr>
											<td
												colSpan={columns.length}
												className="px-4 py-8 text-center text-gray-500"
											>
												No imaging history yet
											</td>
										</tr>
									) : (
										imagingTable.getRowModel().rows.map((row) => (
											<tr key={row.id} className="hover:bg-gray-800/40">
												{row.getVisibleCells().map((cell) => (
													<td key={cell.id} className="px-4 py-3 text-gray-200">
														{flexRender(
															cell.column.columnDef.cell,
															cell.getContext(),
														)}
													</td>
												))}
											</tr>
										))
									)}
								</tbody>
							</table>
						</div>
					)}
				</>
			)}

			{tab === "inventory" && (
				<>
					{inventoryQuery.isLoading && (
						<div className="text-gray-400">Loading…</div>
					)}
					{inventoryQuery.error && (
						<div className="text-red-400">Error loading inventory</div>
					)}
					{!inventoryQuery.isLoading && !inventoryQuery.error && (
						<div className="overflow-hidden rounded-xl border border-gray-800">
							<table className="w-full text-sm">
								<thead className="bg-gray-800 text-gray-400">
									<tr>
										{["Host", "CPU", "RAM", "Disk", "OS", "Serial"].map((h) => (
											<th key={h} className="px-4 py-3 text-left font-medium">
												{h}
											</th>
										))}
									</tr>
								</thead>
								<tbody className="divide-y divide-gray-800 bg-gray-900">
									{(inventoryQuery.data?.data ?? []).length === 0 ? (
										<tr>
											<td
												colSpan={6}
												className="px-4 py-8 text-center text-gray-500"
											>
												No inventory data yet
											</td>
										</tr>
									) : (
										(inventoryQuery.data?.data ?? []).map((row) => {
											const inv = row.inventory as {
												cpuModel?: string;
												cpuCores?: number;
												ramMib?: number;
												hdSizeGb?: number;
												osName?: string;
												serial?: string;
											} | null;
											return (
												<tr key={row.id} className="hover:bg-gray-800/40">
													<td className="px-4 py-3 text-gray-200 font-medium">
														{row.name}
													</td>
													<td className="px-4 py-3 text-gray-400">
														{inv?.cpuModel ?? "—"}
														{inv?.cpuCores ? ` (${inv.cpuCores}c)` : ""}
													</td>
													<td className="px-4 py-3 text-gray-400">
														{inv?.ramMib
															? `${(inv.ramMib / 1024).toFixed(1)} GiB`
															: "—"}
													</td>
													<td className="px-4 py-3 text-gray-400">
														{inv?.hdSizeGb ? `${inv.hdSizeGb} GiB` : "—"}
													</td>
													<td className="px-4 py-3 text-gray-400">
														{inv?.osName ?? "—"}
													</td>
													<td className="px-4 py-3 text-gray-400 font-mono text-xs">
														{inv?.serial ?? "—"}
													</td>
												</tr>
											);
										})
									)}
								</tbody>
							</table>
						</div>
					)}
				</>
			)}
		</div>
	);
}
