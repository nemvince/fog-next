import { flexRender, type Table as TanTable } from "@tanstack/react-table";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./Button";

interface DataTableProps<T> {
	table: TanTable<T>;
	isLoading?: boolean;
	emptyMessage?: string;
	className?: string;
}

export function DataTable<T>({
	table,
	isLoading,
	emptyMessage = "No results",
	className,
}: DataTableProps<T>) {
	return (
		<div
			className={cn(
				"overflow-hidden rounded-xl border border-gray-800",
				className,
			)}
		>
			<div className="overflow-x-auto">
				<table className="w-full text-sm">
					<thead className="bg-gray-800 text-gray-400">
						{table.getHeaderGroups().map((hg) => (
							<tr key={hg.id}>
								{hg.headers.map((h) => (
									<th
										key={h.id}
										className={cn(
											"px-4 py-3 text-left font-medium",
											h.column.getCanSort() &&
												"cursor-pointer select-none hover:text-gray-200",
										)}
										onClick={h.column.getToggleSortingHandler()}
									>
										<span className="flex items-center gap-1">
											{flexRender(h.column.columnDef.header, h.getContext())}
											{{ asc: " ↑", desc: " ↓" }[
												h.column.getIsSorted() as string
											] ?? ""}
										</span>
									</th>
								))}
							</tr>
						))}
					</thead>
					<tbody className="divide-y divide-gray-800 bg-gray-900">
						{isLoading ? (
							<tr>
								<td
									colSpan={100}
									className="px-4 py-8 text-center text-gray-500"
								>
									Loading…
								</td>
							</tr>
						) : table.getRowModel().rows.length === 0 ? (
							<tr>
								<td
									colSpan={100}
									className="px-4 py-8 text-center text-gray-500"
								>
									{emptyMessage}
								</td>
							</tr>
						) : (
							table.getRowModel().rows.map((row) => (
								<tr
									key={row.id}
									className="hover:bg-gray-800/50 transition-colors"
								>
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

			{/* Pagination */}
			{(table.getCanPreviousPage() || table.getCanNextPage()) && (
				<div className="flex items-center justify-between border-t border-gray-800 px-4 py-3">
					<span className="text-xs text-gray-500">
						Page {table.getState().pagination.pageIndex + 1} of{" "}
						{table.getPageCount()}
					</span>
					<div className="flex gap-1">
						<Button
							variant="ghost"
							size="icon"
							onClick={() => table.previousPage()}
							disabled={!table.getCanPreviousPage()}
						>
							<ChevronLeft className="h-4 w-4" />
						</Button>
						<Button
							variant="ghost"
							size="icon"
							onClick={() => table.nextPage()}
							disabled={!table.getCanNextPage()}
						>
							<ChevronRight className="h-4 w-4" />
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}
