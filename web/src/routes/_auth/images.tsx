import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import type { Image, Paginated } from "@/types";
import { Pencil, Plus, Trash } from "@phosphor-icons/react";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	createColumnHelper,
	flexRender,
	getCoreRowModel,
	useReactTable,
} from "@tanstack/react-table";
import { useState } from "react";
import { toast } from "sonner";
import * as z from "zod";

export const Route = createFileRoute("/_auth/images")({
	component: ImagesPage,
});

const col = createColumnHelper<Image>();

const columns = [
	col.accessor("name", { header: "Name" }),
	col.accessor("description", { header: "Description" }),
	col.accessor("path", { header: "Path" }),
	col.accessor("sizeBytes", {
		header: "Size",
		cell: (info) => {
			const bytes = info.getValue();
			if (!bytes) return "—";
			return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
		},
	}),
	col.accessor("isEnabled", {
		header: "Status",
		cell: (info) =>
			info.getValue() ? <Badge variant="default">Enabled</Badge> : <Badge variant="secondary">Disabled</Badge>,
	}),
];

const imageSchema = z.object({
	name: z.string().min(1, "Name is required"),
	description: z.string(),
	path: z.string().min(1, "Path is required"),
	partitions: z.string().refine((v) => {
		if (!v || v.trim() === "") return true;
		try {
			JSON.parse(v);
			return true;
		} catch {
			return false;
		}
	}, "Must be valid JSON"),
});

function ImagesPage() {
	const qc = useQueryClient();
	const [page, setPage] = useState(1);
	const [open, setOpen] = useState(false);
	const [editTarget, setEditTarget] = useState<Image | null>(null);

	const { data, isLoading } = useQuery({
		queryKey: ["images", page],
		queryFn: () => api.get<Paginated<Image>>(`/images?page=${page}&limit=25`),
	});

	const createMutation = useMutation({
		mutationFn: (values: z.infer<typeof imageSchema>) => {
			const body = {
				...values,
				partitions: values.partitions ? JSON.parse(values.partitions) : undefined,
			};
			return api.post<Image>("/images", body);
		},
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: ["images"] });
			setOpen(false);
			toast.success("Image created");
		},
		onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
	});

	const updateMutation = useMutation({
		mutationFn: ({ id, values }: { id: string; values: z.infer<typeof imageSchema> }) => {
			const body = {
				...values,
				partitions: values.partitions ? JSON.parse(values.partitions) : undefined,
			};
			return api.put<Image>(`/images/${id}`, body);
		},
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: ["images"] });
			setEditTarget(null);
			toast.success("Image updated");
		},
		onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => api.del<void>(`/images/${id}`),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: ["images"] });
			toast.success("Image deleted");
		},
		onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
	});

	const form = useForm({
		defaultValues: { name: "", description: "", path: "", partitions: "" },
		validators: { onSubmit: imageSchema },
		onSubmit: ({ value }) => createMutation.mutate(value),
	});

	const editForm = useForm({
		defaultValues: {
			name: editTarget?.name ?? "",
			description: editTarget?.description ?? "",
			path: editTarget?.path ?? "",
			partitions: editTarget?.partitions ? JSON.stringify(editTarget.partitions, null, 2) : "",
		},
		validators: { onSubmit: imageSchema },
		onSubmit: ({ value }) => {
			if (editTarget) updateMutation.mutate({ id: editTarget.id, values: value });
		},
	});

	const table = useReactTable({
		data: data?.data ?? [],
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	const ImageFormFields = ({ formInstance }: { formInstance: typeof form }) => (
		<FieldGroup>
			<formInstance.Field name="name">
				{(field) => {
					const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
					return (
						<Field data-invalid={isInvalid}>
							<FieldLabel htmlFor={field.name}>Name</FieldLabel>
							<Input
								id={field.name}
								name={field.name}
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								aria-invalid={isInvalid}
							/>
							{isInvalid && <FieldError errors={field.state.meta.errors} />}
						</Field>
					);
				}}
			</formInstance.Field>
			<formInstance.Field name="description">
				{(field) => (
					<Field>
						<FieldLabel htmlFor={field.name}>Description</FieldLabel>
						<Input
							id={field.name}
							name={field.name}
							value={field.state.value}
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
						/>
					</Field>
				)}
			</formInstance.Field>
			<formInstance.Field name="path">
				{(field) => {
					const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
					return (
						<Field data-invalid={isInvalid}>
							<FieldLabel htmlFor={field.name}>Path</FieldLabel>
							<Input
								id={field.name}
								name={field.name}
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								aria-invalid={isInvalid}
							/>
							{isInvalid && <FieldError errors={field.state.meta.errors} />}
						</Field>
					);
				}}
			</formInstance.Field>
			<formInstance.Field name="partitions">
				{(field) => {
					const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
					return (
						<Field data-invalid={isInvalid}>
							<FieldLabel htmlFor={field.name}>Partitions</FieldLabel>
							<Textarea
								id={field.name}
								name={field.name}
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								aria-invalid={isInvalid}
								className="min-h-[100px] font-mono text-xs"
								placeholder='[{"name":"sda1","type":"ext4"}]'
							/>
							<FieldDescription>Optional JSON partition layout</FieldDescription>
							{isInvalid && <FieldError errors={field.state.meta.errors} />}
						</Field>
					);
				}}
			</formInstance.Field>
		</FieldGroup>
	);

	return (
		<div className="flex flex-col gap-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold">Images</h1>
					<p className="text-muted-foreground">Manage disk images</p>
				</div>
				<Button onClick={() => setOpen(true)}>
					<Plus data-icon="inline-start" />
					Add Image
				</Button>
			</div>

			<div className="rounded-lg border">
				<Table>
					<TableHeader>
						{table.getHeaderGroups().map((hg) => (
							<TableRow key={hg.id}>
								{hg.headers.map((h) => (
									<TableHead key={h.id}>
										{flexRender(h.column.columnDef.header, h.getContext())}
									</TableHead>
								))}
								<TableHead />
							</TableRow>
						))}
					</TableHeader>
					<TableBody>
						{isLoading ? (
							<TableRow>
								<TableCell colSpan={columns.length + 1} className="text-center text-muted-foreground py-8">
									Loading…
								</TableCell>
							</TableRow>
						) : table.getRowModel().rows.length === 0 ? (
							<TableRow>
								<TableCell colSpan={columns.length + 1} className="text-center text-muted-foreground py-8">
									No images found
								</TableCell>
							</TableRow>
						) : (
							table.getRowModel().rows.map((row) => (
								<TableRow key={row.id}>
									{row.getVisibleCells().map((cell) => (
										<TableCell key={cell.id}>
											{flexRender(cell.column.columnDef.cell, cell.getContext())}
										</TableCell>
									))}
									<TableCell className="text-right">
										<div className="flex justify-end gap-1">
											<Button
												variant="ghost"
												size="icon-xs"
												onClick={() => setEditTarget(row.original)}
											>
												<Pencil />
											</Button>
											<AlertDialog>
												<AlertDialogTrigger render={
													<Button variant="ghost" size="icon-xs">
														<Trash />
													</Button>
												} />
												<AlertDialogContent>
													<AlertDialogHeader>
														<AlertDialogTitle>Delete image?</AlertDialogTitle>
														<AlertDialogDescription>
															This will permanently delete "{row.original.name}".
														</AlertDialogDescription>
													</AlertDialogHeader>
													<AlertDialogFooter>
														<AlertDialogCancel>Cancel</AlertDialogCancel>
														<AlertDialogAction onClick={() => deleteMutation.mutate(row.original.id)}>
															Delete
														</AlertDialogAction>
													</AlertDialogFooter>
												</AlertDialogContent>
											</AlertDialog>
										</div>
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</div>

			{data && data.total > 25 && (
				<div className="flex items-center justify-end gap-2">
					<Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
						Previous
					</Button>
					<span className="text-sm text-muted-foreground">
						Page {page} of {Math.ceil(data.total / 25)}
					</span>
					<Button
						variant="outline"
						size="sm"
						disabled={page >= Math.ceil(data.total / 25)}
						onClick={() => setPage((p) => p + 1)}
					>
						Next
					</Button>
				</div>
			)}

			{/* Create Dialog */}
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Add Image</DialogTitle>
					</DialogHeader>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							void form.handleSubmit();
						}}
					>
						<ImageFormFields formInstance={form} />
						<DialogFooter className="mt-4">
							<Button type="button" variant="outline" onClick={() => setOpen(false)}>
								Cancel
							</Button>
							<form.Subscribe selector={(s) => s.isSubmitting}>
								{(isSubmitting) => (
									<Button type="submit" disabled={isSubmitting}>
										{isSubmitting ? "Creating…" : "Create"}
									</Button>
								)}
							</form.Subscribe>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			{/* Edit Dialog */}
			<Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Edit Image</DialogTitle>
					</DialogHeader>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							void editForm.handleSubmit();
						}}
					>
						<ImageFormFields formInstance={editForm as typeof form} />
						<DialogFooter className="mt-4">
							<Button type="button" variant="outline" onClick={() => setEditTarget(null)}>
								Cancel
							</Button>
							<editForm.Subscribe selector={(s) => s.isSubmitting}>
								{(isSubmitting) => (
									<Button type="submit" disabled={isSubmitting}>
										{isSubmitting ? "Saving…" : "Save"}
									</Button>
								)}
							</editForm.Subscribe>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	);
}
