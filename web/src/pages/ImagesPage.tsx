import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	createColumnHelper,
	getCoreRowModel,
	getSortedRowModel,
	useReactTable,
} from "@tanstack/react-table";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { type Image, imagesApi } from "@/api/client";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { toast } from "@/components/ui/Toast";

const col = createColumnHelper<Image>();

export function ImagesPage() {
	const qc = useQueryClient();
	const [open, setOpen] = useState(false);
	const [form, setForm] = useState({ name: "", description: "", path: "" });

	const { data, isLoading } = useQuery({
		queryKey: ["images"],
		queryFn: () => imagesApi.list(),
	});

	const createMutation = useMutation({
		mutationFn: () => imagesApi.create(form),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: ["images"] });
			setOpen(false);
			setForm({ name: "", description: "", path: "" });
			toast("Image created", { variant: "success" });
		},
		onError: (e: Error) => toast(e.message, { variant: "destructive" }),
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => imagesApi.delete(id),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: ["images"] });
			toast("Image deleted");
		},
		onError: (e: Error) => toast(e.message, { variant: "destructive" }),
	});

	const columns = [
		col.accessor("name", { header: "Name" }),
		col.accessor("path", { header: "Path" }),
		col.accessor("sizeBytes", {
			header: "Size",
			cell: (info) => formatBytes(info.getValue()),
		}),
		col.accessor("isEnabled", {
			header: "Enabled",
			cell: (info) => (
				<Badge variant={info.getValue() ? "success" : "outline"}>
					{info.getValue() ? "Yes" : "No"}
				</Badge>
			),
		}),
		col.accessor("toReplicate", {
			header: "Replicate",
			cell: (info) => (
				<Badge variant={info.getValue() ? "default" : "outline"}>
					{info.getValue() ? "Yes" : "No"}
				</Badge>
			),
		}),
		col.display({
			id: "actions",
			cell: (info) => (
				<Button
					variant="ghost"
					size="icon"
					onClick={() => deleteMutation.mutate(info.row.original.id)}
				>
					<Trash2 className="h-4 w-4 text-red-400" />
				</Button>
			),
		}),
	];

	const table = useReactTable({
		data: data?.data ?? [],
		columns,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
	});

	return (
		<div className="p-8">
			<div className="mb-6 flex items-center justify-between">
				<h1 className="text-2xl font-bold">Images</h1>
				<Button onClick={() => setOpen(true)}>
					<Plus className="h-4 w-4" /> New Image
				</Button>
			</div>

			<DataTable
				table={table}
				isLoading={isLoading}
				emptyMessage="No images defined"
			/>

			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle className="text-lg font-semibold text-gray-100">
							Create Image
						</DialogTitle>
					</DialogHeader>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							createMutation.mutate();
						}}
						className="flex flex-col gap-4"
					>
						<Input
							label="Name"
							value={form.name}
							onChange={(e) => setForm({ ...form, name: e.target.value })}
							required
						/>
						<Input
							label="Description"
							value={form.description}
							onChange={(e) =>
								setForm({ ...form, description: e.target.value })
							}
						/>
						<Input
							label="Path (relative to storage root)"
							value={form.path}
							onChange={(e) => setForm({ ...form, path: e.target.value })}
							required
						/>
						<div className="flex justify-end gap-2">
							<Button
								type="button"
								variant="outline"
								onClick={() => setOpen(false)}
							>
								Cancel
							</Button>
							<Button type="submit" disabled={createMutation.isPending}>
								Create
							</Button>
						</div>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	);
}

function formatBytes(bytes: number) {
	if (bytes === 0) return "—";
	const gb = bytes / 1_073_741_824;
	if (gb >= 1) return `${gb.toFixed(1)} GB`;
	const mb = bytes / 1_048_576;
	return `${mb.toFixed(0)} MB`;
}
