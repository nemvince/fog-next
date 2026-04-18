import { type Group, groupsApi } from "@/api/client";
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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    createColumnHelper,
    getCoreRowModel,
    useReactTable,
} from "@tanstack/react-table";
import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

const col = createColumnHelper<Group>();

export function GroupsPage() {
	const qc = useQueryClient();
	const [open, setOpen] = useState(false);
	const [form, setForm] = useState({ name: "", description: "" });

	const { data, isLoading } = useQuery({
		queryKey: ["groups"],
		queryFn: () => groupsApi.list(),
	});

	const createMutation = useMutation({
		mutationFn: () => groupsApi.create(form),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: ["groups"] });
			setOpen(false);
			setForm({ name: "", description: "" });
			toast("Group created", { variant: "success" });
		},
		onError: (e: Error) => toast(e.message, { variant: "destructive" }),
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => groupsApi.delete(id),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: ["groups"] });
			toast("Group deleted");
		},
		onError: (e: Error) => toast(e.message, { variant: "destructive" }),
	});

	const columns = useMemo(() => [
		col.accessor("name", { header: "Name" }),
		col.accessor("description", { header: "Description" }),
		col.accessor("createdAt", {
			header: "Created",
			cell: (info) => new Date(info.getValue()).toLocaleDateString(),
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
	], [deleteMutation.mutate]);

	const table = useReactTable({
		data: data?.data ?? [],
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	return (
		<div className="p-8">
			<div className="mb-6 flex items-center justify-between">
				<h1 className="text-2xl font-bold">Groups</h1>
				<Button onClick={() => setOpen(true)}>
					<Plus className="h-4 w-4" /> New Group
				</Button>
			</div>

			<DataTable
				table={table}
				isLoading={isLoading}
				emptyMessage="No groups defined"
			/>

			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle className="text-lg font-semibold text-gray-100">
							Create Group
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
