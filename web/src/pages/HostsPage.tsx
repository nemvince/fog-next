import { type Host, hostsApi } from "@/api/client";
import { Badge } from "@/components/ui/Badge";
import { useQuery } from "@tanstack/react-query";
import {
    createColumnHelper,
    flexRender,
    getCoreRowModel,
    useReactTable,
} from "@tanstack/react-table";
import { useNavigate } from "react-router-dom";

const col = createColumnHelper<Host>();

const columns = [
	col.accessor("name", { header: "Name" }),
	col.accessor("ip", { header: "IP Address" }),
	col.accessor("isEnabled", {
		header: "Enabled",
		cell: (info) => (
			<Badge variant={info.getValue() ? "success" : "outline"}>
				{info.getValue() ? "Yes" : "No"}
			</Badge>
		),
	}),
	col.accessor("lastContact", {
		header: "Last Contact",
		cell: (info) => {
			const v = info.getValue();
			return v ? new Date(v).toLocaleString() : "Never";
		},
	}),
];

export function HostsPage() {
	const navigate = useNavigate();

	const { data, isLoading, error } = useQuery({
		queryKey: ["hosts"],
		queryFn: () => hostsApi.list(),
	});

	const table = useReactTable({
		data: data?.data ?? [],
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	if (isLoading) return <div className="p-8 text-gray-400">Loading…</div>;
	if (error) return <div className="p-8 text-red-400">Error loading hosts</div>;

	return (
		<div className="p-8">
			<h1 className="mb-6 text-2xl font-bold">Hosts</h1>
			<div className="overflow-hidden rounded-xl border border-gray-800">
				<table className="w-full text-sm">
					<thead className="bg-gray-800 text-gray-400">
						{table.getHeaderGroups().map((hg) => (
							<tr key={hg.id}>
								{hg.headers.map((h) => (
									<th key={h.id} className="px-4 py-3 text-left font-medium">
										{flexRender(h.column.columnDef.header, h.getContext())}
									</th>
								))}
							</tr>
						))}
					</thead>
					<tbody className="divide-y divide-gray-800 bg-gray-900">
						{table.getRowModel().rows.map((row) => (
							<tr
								key={row.id}
								className="cursor-pointer hover:bg-gray-800/50"
								onClick={() => navigate(`/hosts/${row.original.id}`)}
							>
								{row.getVisibleCells().map((cell) => (
									<td key={cell.id} className="px-4 py-3 text-gray-200">
										{flexRender(cell.column.columnDef.cell, cell.getContext())}
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
				{data?.data.length === 0 && (
					<p className="p-6 text-center text-gray-500">No hosts registered</p>
				)}
			</div>
		</div>
	);
}
