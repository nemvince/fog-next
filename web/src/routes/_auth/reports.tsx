import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import type { Host, ImagingLog, Inventory, Paginated } from "@/types";
import { Download } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/_auth/reports")({
	component: ReportsPage,
});

function downloadCsv(filename: string, rows: string[][]) {
	const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
	const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}

function ImagingHistoryTab() {
	const [page, setPage] = useState(1);

	const { data, isLoading } = useQuery({
		queryKey: ["imaging-logs", page],
		queryFn: () => api.get<Paginated<ImagingLog>>(`/reports/imaging?page=${page}&limit=50`),
	});

	const logs = data?.data ?? [];

	return (
		<div className="flex flex-col gap-4">
			<div className="flex justify-end">
				<Button
					variant="outline"
					size="sm"
					disabled={logs.length === 0}
					onClick={() =>
						downloadCsv("imaging-history.csv", [
							["Host", "Image", "Type", "State", "Duration", "Date"],
							...logs.map((l) => [
								l.hostId,
								l.imageId ?? "",
								l.type,
								l.state,
								String(l.durationSeconds ?? ""),
								l.createdAt,
							]),
						])
					}
				>
					<Download data-icon="inline-start" />
					Export CSV
				</Button>
			</div>
			<div className="rounded-lg border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Host ID</TableHead>
							<TableHead>Image</TableHead>
							<TableHead>Type</TableHead>
							<TableHead>State</TableHead>
							<TableHead>Duration</TableHead>
							<TableHead>Date</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{isLoading ? (
							<TableRow>
								<TableCell colSpan={6} className="text-center text-muted-foreground py-8">Loading…</TableCell>
							</TableRow>
						) : logs.length === 0 ? (
							<TableRow>
								<TableCell colSpan={6} className="text-center text-muted-foreground py-8">No imaging history</TableCell>
							</TableRow>
						) : (
							logs.map((log) => (
								<TableRow key={log.id}>
									<TableCell>{log.hostId}</TableCell>
									<TableCell>{log.imageId ?? "—"}</TableCell>
									<TableCell>{log.type}</TableCell>
									<TableCell>
										<Badge
											variant={
												log.state === "complete"
													? "default"
													: log.state === "failed"
													? "destructive"
													: "secondary"
											}
										>
											{log.state}
										</Badge>
									</TableCell>
									<TableCell>
										{log.durationSeconds != null ? `${log.durationSeconds}s` : "—"}
									</TableCell>
									<TableCell className="text-sm text-muted-foreground">
										{new Date(log.createdAt).toLocaleString()}
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</div>
			{data && data.total > 50 && (
				<div className="flex items-center justify-end gap-2">
					<Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
					<span className="text-sm text-muted-foreground">Page {page} of {Math.ceil(data.total / 50)}</span>
					<Button variant="outline" size="sm" disabled={page >= Math.ceil(data.total / 50)} onClick={() => setPage((p) => p + 1)}>Next</Button>
				</div>
			)}
		</div>
	);
}

function HostInventoryTab() {
	const hostsQuery = useQuery({
		queryKey: ["hosts", "all"],
		queryFn: () => api.get<Paginated<Host>>("/hosts?page=1&limit=1000"),
	});

	const inventoryQuery = useQuery({
		queryKey: ["inventory", "all"],
		queryFn: () => api.get<{ data: (Inventory & { hostId: string })[] }>("/reports/inventory"),
	});

	const hosts = hostsQuery.data?.data ?? [];
	const inventories = inventoryQuery.data?.data ?? [];

	// Join inventory with host names
	const rows = inventories.map((inv) => {
		const host = hosts.find((h) => h.id === inv.hostId);
		return { ...inv, hostName: host?.name ?? inv.hostId };
	});

	return (
		<div className="flex flex-col gap-4">
			<div className="flex justify-end">
				<Button
					variant="outline"
					size="sm"
					disabled={rows.length === 0}
					onClick={() =>
						downloadCsv("host-inventory.csv", [
							["Host", "CPU", "Cores", "RAM (MiB)", "Disk Model", "Disk (GB)", "OS", "Serial"],
							...rows.map((r) => [
								r.hostName,
								r.cpuModel,
								String(r.cpuCores),
								String(r.ramMib),
								r.hdModel,
								String(r.hdSizeGb),
								`${r.osName} ${r.osVersion}`,
								r.serial ?? "",
							]),
						])
					}
				>
					<Download data-icon="inline-start" />
					Export CSV
				</Button>
			</div>
			<div className="rounded-lg border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Host</TableHead>
							<TableHead>CPU</TableHead>
							<TableHead>RAM</TableHead>
							<TableHead>Disk</TableHead>
							<TableHead>OS</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{inventoryQuery.isLoading ? (
							<TableRow>
								<TableCell colSpan={5} className="text-center text-muted-foreground py-8">Loading…</TableCell>
							</TableRow>
						) : rows.length === 0 ? (
							<TableRow>
								<TableCell colSpan={5} className="text-center text-muted-foreground py-8">No inventory data</TableCell>
							</TableRow>
						) : (
							rows.map((row) => (
								<TableRow key={row.id}>
									<TableCell className="font-medium">{row.hostName}</TableCell>
									<TableCell>{row.cpuModel} ({row.cpuCores} cores)</TableCell>
									<TableCell>{row.ramMib} MiB</TableCell>
									<TableCell>{row.hdModel} ({row.hdSizeGb} GB)</TableCell>
									<TableCell>{row.osName} {row.osVersion}</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}

function ReportsPage() {
	return (
		<div className="flex flex-col gap-6">
			<div>
				<h1 className="text-2xl font-bold">Reports</h1>
				<p className="text-muted-foreground">Imaging history and host inventory</p>
			</div>

			<Tabs defaultValue="imaging">
				<TabsList>
					<TabsTrigger value="imaging">Imaging History</TabsTrigger>
					<TabsTrigger value="inventory">Host Inventory</TabsTrigger>
				</TabsList>
				<TabsContent value="imaging">
					<ImagingHistoryTab />
				</TabsContent>
				<TabsContent value="inventory">
					<HostInventoryTab />
				</TabsContent>
			</Tabs>
		</div>
	);
}
