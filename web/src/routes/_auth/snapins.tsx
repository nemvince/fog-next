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
import { api } from "@/lib/api";
import type { Paginated, Snapin } from "@/types";
import { Pencil, Plus, Trash, Upload } from "@phosphor-icons/react";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import * as z from "zod";

export const Route = createFileRoute("/_auth/snapins")({
	component: SnapinsPage,
});

const snapinSchema = z.object({
	name: z.string().min(1, "Name is required"),
	description: z.string(),
	runOrder: z.number().int().min(0),
	timeout: z.number().int().min(0),
});

function SnapinsPage() {
	const qc = useQueryClient();
	const [createOpen, setCreateOpen] = useState(false);
	const [editTarget, setEditTarget] = useState<Snapin | null>(null);
	const [uploadTarget, setUploadTarget] = useState<Snapin | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const { data, isLoading } = useQuery({
		queryKey: ["snapins"],
		queryFn: () => api.get<Paginated<Snapin>>("/snapins?page=1&limit=1000"),
	});

	const createMutation = useMutation({
		mutationFn: (values: z.infer<typeof snapinSchema>) => api.post<Snapin>("/snapins", values),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: ["snapins"] });
			setCreateOpen(false);
			toast.success("Snapin created");
		},
		onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
	});

	const updateMutation = useMutation({
		mutationFn: ({ id, values }: { id: string; values: z.infer<typeof snapinSchema> }) =>
			api.put<Snapin>(`/snapins/${id}`, values),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: ["snapins"] });
			setEditTarget(null);
			toast.success("Snapin updated");
		},
		onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => api.del<void>(`/snapins/${id}`),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: ["snapins"] });
			toast.success("Snapin deleted");
		},
		onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
	});

	const uploadMutation = useMutation({
		mutationFn: ({ id, file }: { id: string; file: File }) => {
			const formData = new FormData();
			formData.append("file", file);
			return api.upload<Snapin>(`/snapins/${id}/upload`, formData);
		},
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: ["snapins"] });
			setUploadTarget(null);
			toast.success("File uploaded");
		},
		onError: (err) => toast.error(err instanceof Error ? err.message : "Upload failed"),
	});

	const form = useForm({
		defaultValues: { name: "", description: "", runOrder: 0, timeout: 300 },
		validators: { onSubmit: snapinSchema },
		onSubmit: ({ value }) => createMutation.mutate(value),
	});

	const editForm = useForm({
		defaultValues: {
			name: editTarget?.name ?? "",
			description: editTarget?.description ?? "",
			runOrder: editTarget?.runOrder ?? 0,
			timeout: editTarget?.timeout ?? 300,
		},
		validators: { onSubmit: snapinSchema },
		onSubmit: ({ value }) => {
			if (editTarget) updateMutation.mutate({ id: editTarget.id, values: value });
		},
	});

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file || !uploadTarget) return;
		uploadMutation.mutate({ id: uploadTarget.id, file });
	};

	const snapins = data?.data ?? [];

	function SnapinFormFields({ formInstance }: { formInstance: typeof form }) {
		return (
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
				<formInstance.Field name="runOrder">
					{(field) => (
						<Field>
							<FieldLabel htmlFor={field.name}>Run Order</FieldLabel>
							<Input
								id={field.name}
								name={field.name}
								type="number"
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(Number(e.target.value))}
							/>
						</Field>
					)}
				</formInstance.Field>
				<formInstance.Field name="timeout">
					{(field) => (
						<Field>
							<FieldLabel htmlFor={field.name}>Timeout (seconds)</FieldLabel>
							<Input
								id={field.name}
								name={field.name}
								type="number"
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(Number(e.target.value))}
							/>
						</Field>
					)}
				</formInstance.Field>
			</FieldGroup>
		);
	}

	return (
		<div className="flex flex-col gap-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold">Snapins</h1>
					<p className="text-muted-foreground">Scripts and files deployed to hosts</p>
				</div>
				<Button onClick={() => setCreateOpen(true)}>
					<Plus data-icon="inline-start" />
					Add Snapin
				</Button>
			</div>

			<div className="rounded-lg border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Name</TableHead>
							<TableHead>Description</TableHead>
							<TableHead>Run Order</TableHead>
							<TableHead>Timeout</TableHead>
							<TableHead>File</TableHead>
							<TableHead />
						</TableRow>
					</TableHeader>
					<TableBody>
						{isLoading ? (
							<TableRow>
								<TableCell colSpan={6} className="text-center text-muted-foreground py-8">Loading…</TableCell>
							</TableRow>
						) : snapins.length === 0 ? (
							<TableRow>
								<TableCell colSpan={6} className="text-center text-muted-foreground py-8">No snapins</TableCell>
							</TableRow>
						) : (
							snapins.map((snapin) => (
								<TableRow key={snapin.id}>
									<TableCell className="font-medium">{snapin.name}</TableCell>
									<TableCell>{snapin.description || "—"}</TableCell>
									<TableCell>{snapin.runOrder}</TableCell>
									<TableCell>{snapin.timeout}s</TableCell>
									<TableCell>
										{snapin.fileName ? (
											<Badge variant="secondary">{snapin.fileName}</Badge>
										) : (
											<span className="text-muted-foreground text-xs">No file</span>
										)}
									</TableCell>
									<TableCell className="text-right">
										<div className="flex justify-end gap-1">
											<Button
												variant="ghost"
												size="icon-xs"
												title="Upload file"
												onClick={() => {
													setUploadTarget(snapin);
													fileInputRef.current?.click();
												}}
											>
												<Upload />
											</Button>
											<Button variant="ghost" size="icon-xs" onClick={() => setEditTarget(snapin)}>
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
														<AlertDialogTitle>Delete snapin?</AlertDialogTitle>
														<AlertDialogDescription>
															This will permanently delete "{snapin.name}".
														</AlertDialogDescription>
													</AlertDialogHeader>
													<AlertDialogFooter>
														<AlertDialogCancel>Cancel</AlertDialogCancel>
														<AlertDialogAction onClick={() => deleteMutation.mutate(snapin.id)}>
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

			{/* Hidden file input for uploads */}
			<input
				ref={fileInputRef}
				type="file"
				className="hidden"
				onChange={handleFileChange}
			/>

			{/* Create Dialog */}
			<Dialog open={createOpen} onOpenChange={setCreateOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Add Snapin</DialogTitle>
					</DialogHeader>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							void form.handleSubmit();
						}}
					>
						<SnapinFormFields formInstance={form} />
						<DialogFooter className="mt-4">
							<Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
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
						<DialogTitle>Edit Snapin</DialogTitle>
					</DialogHeader>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							void editForm.handleSubmit();
						}}
					>
						<SnapinFormFields formInstance={editForm as typeof form} />
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
