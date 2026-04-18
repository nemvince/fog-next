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
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
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
import type { StorageGroup, StorageNode } from "@/types";
import { Pencil, Plus, Trash } from "@phosphor-icons/react";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import * as z from "zod";

export const Route = createFileRoute("/_auth/storage")({
	component: StoragePage,
});

const groupSchema = z.object({
	name: z.string().min(1, "Required"),
	description: z.string(),
});

const nodeSchema = z.object({
	name: z.string().min(1, "Required"),
	description: z.string(),
	ip: z.string().min(1, "Required"),
	path: z.string().min(1, "Required"),
	maxClients: z.number().int().min(1),
	bandwidthMbps: z.number().int().min(0),
});

function StoragePage() {
	const qc = useQueryClient();
	const [selectedGroup, setSelectedGroup] = useState<StorageGroup | null>(null);
	const [createGroupOpen, setCreateGroupOpen] = useState(false);
	const [createNodeOpen, setCreateNodeOpen] = useState(false);
	const [editNode, setEditNode] = useState<StorageNode | null>(null);

	const groupsQuery = useQuery({
		queryKey: ["storage-groups"],
		queryFn: () => api.get<{ data: StorageGroup[] }>("/storage/groups"),
	});

	const nodesQuery = useQuery({
		queryKey: ["storage-nodes", selectedGroup?.id],
		queryFn: () => api.get<{ data: StorageNode[] }>(`/storage/groups/${selectedGroup!.id}/nodes`),
		enabled: !!selectedGroup,
	});

	const createGroupMutation = useMutation({
		mutationFn: (values: z.infer<typeof groupSchema>) => api.post<StorageGroup>("/storage/groups", values),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: ["storage-groups"] });
			setCreateGroupOpen(false);
			toast.success("Storage group created");
		},
		onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
	});

	const deleteGroupMutation = useMutation({
		mutationFn: (id: string) => api.del<void>(`/storage/groups/${id}`),
		onSuccess: (_, id) => {
			void qc.invalidateQueries({ queryKey: ["storage-groups"] });
			if (selectedGroup?.id === id) setSelectedGroup(null);
			toast.success("Storage group deleted");
		},
		onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
	});

	const createNodeMutation = useMutation({
		mutationFn: (values: z.infer<typeof nodeSchema>) =>
			api.post<StorageNode>(`/storage/groups/${selectedGroup!.id}/nodes`, values),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: ["storage-nodes", selectedGroup?.id] });
			setCreateNodeOpen(false);
			toast.success("Node added");
		},
		onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
	});

	const updateNodeMutation = useMutation({
		mutationFn: ({ id, values }: { id: string; values: z.infer<typeof nodeSchema> }) =>
			api.put<StorageNode>(`/storage/nodes/${id}`, values),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: ["storage-nodes", selectedGroup?.id] });
			setEditNode(null);
			toast.success("Node updated");
		},
		onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
	});

	const deleteNodeMutation = useMutation({
		mutationFn: (id: string) => api.del<void>(`/storage/nodes/${id}`),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: ["storage-nodes", selectedGroup?.id] });
			toast.success("Node removed");
		},
		onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
	});

	const groupForm = useForm({
		defaultValues: { name: "", description: "" },
		validators: { onSubmit: groupSchema },
		onSubmit: ({ value }) => createGroupMutation.mutate(value),
	});

	const nodeForm = useForm({
		defaultValues: { name: "", description: "", ip: "", path: "", maxClients: 10, bandwidthMbps: 0 },
		validators: { onSubmit: nodeSchema },
		onSubmit: ({ value }) => createNodeMutation.mutate(value),
	});

	const editNodeForm = useForm({
		defaultValues: {
			name: editNode?.name ?? "",
			description: editNode?.description ?? "",
			ip: editNode?.ip ?? "",
			path: editNode?.path ?? "",
			maxClients: editNode?.maxClients ?? 10,
			bandwidthMbps: editNode?.bandwidthMbps ?? 0,
		},
		validators: { onSubmit: nodeSchema },
		onSubmit: ({ value }) => {
			if (editNode) updateNodeMutation.mutate({ id: editNode.id, values: value });
		},
	});

	const groups = groupsQuery.data?.data ?? [];
	const nodes = nodesQuery.data?.data ?? [];

	function NodeFormFields({ formInstance }: { formInstance: typeof nodeForm }) {
		return (
			<FieldGroup>
				{(["name", "ip", "path", "description"] as const).map((fieldName) => (
					<formInstance.Field key={fieldName} name={fieldName}>
						{(field) => {
							const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
							return (
								<Field data-invalid={isInvalid}>
									<FieldLabel htmlFor={field.name} className="capitalize">{fieldName}</FieldLabel>
									<Input
										id={field.name}
										name={field.name}
										value={field.state.value as string}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										aria-invalid={isInvalid}
									/>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
								</Field>
							);
						}}
					</formInstance.Field>
				))}
				{(["maxClients", "bandwidthMbps"] as const).map((fieldName) => {
					const labels: Record<string, string> = {
						maxClients: "Max Clients",
						bandwidthMbps: "Bandwidth (Mbps)",
					};
					return (
						<formInstance.Field key={fieldName} name={fieldName}>
							{(field) => (
								<Field>
									<FieldLabel htmlFor={field.name}>{labels[fieldName]}</FieldLabel>
									<Input
										id={field.name}
										name={field.name}
										type="number"
										value={field.state.value as number}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(Number(e.target.value))}
									/>
								</Field>
							)}
						</formInstance.Field>
					);
				})}
			</FieldGroup>
		);
	}

	return (
		<div className="flex flex-col gap-6">
			<div>
				<h1 className="text-2xl font-bold">Storage</h1>
				<p className="text-muted-foreground">Manage storage groups and nodes</p>
			</div>

			<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
				{/* Storage Groups */}
				<Card className="md:col-span-1">
					<CardHeader className="flex flex-row items-center justify-between">
						<CardTitle>Storage Groups</CardTitle>
						<Button size="sm" variant="ghost" onClick={() => setCreateGroupOpen(true)}>
							<Plus />
						</Button>
					</CardHeader>
					<CardContent className="p-0">
						{groups.length === 0 ? (
							<p className="px-4 py-6 text-sm text-muted-foreground">No groups</p>
						) : (
							<Table>
								<TableBody>
									{groups.map((group) => (
										<TableRow
											key={group.id}
											className="cursor-pointer"
											data-selected={selectedGroup?.id === group.id}
											onClick={() => setSelectedGroup(group)}
										>
											<TableCell>
												<div className="font-medium">{group.name}</div>
											</TableCell>
											<TableCell className="text-right">
												<AlertDialog>
													<AlertDialogTrigger render={
														<Button variant="ghost" size="icon-xs" onClick={(e) => e.stopPropagation()}>
															<Trash />
														</Button>
													} />
													<AlertDialogContent>
														<AlertDialogHeader>
															<AlertDialogTitle>Delete group?</AlertDialogTitle>
															<AlertDialogDescription>
																This will delete "{group.name}" and all its nodes.
															</AlertDialogDescription>
														</AlertDialogHeader>
														<AlertDialogFooter>
															<AlertDialogCancel>Cancel</AlertDialogCancel>
															<AlertDialogAction onClick={() => deleteGroupMutation.mutate(group.id)}>
																Delete
															</AlertDialogAction>
														</AlertDialogFooter>
													</AlertDialogContent>
												</AlertDialog>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						)}
					</CardContent>
				</Card>

				{/* Nodes */}
				<Card className="md:col-span-2">
					<CardHeader className="flex flex-row items-center justify-between">
						<div>
							<CardTitle>{selectedGroup ? selectedGroup.name : "Nodes"}</CardTitle>
							<CardDescription>
								{selectedGroup ? "Storage nodes in this group" : "Select a group to manage nodes"}
							</CardDescription>
						</div>
						{selectedGroup && (
							<Button size="sm" onClick={() => setCreateNodeOpen(true)}>
								<Plus data-icon="inline-start" />
								Add Node
							</Button>
						)}
					</CardHeader>
					<CardContent>
						{!selectedGroup ? null : nodesQuery.isLoading ? (
							<p className="text-sm text-muted-foreground">Loading…</p>
						) : nodes.length === 0 ? (
							<p className="text-sm text-muted-foreground">No nodes</p>
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Name</TableHead>
										<TableHead>IP</TableHead>
										<TableHead>Path</TableHead>
										<TableHead>Clients</TableHead>
										<TableHead>Status</TableHead>
										<TableHead />
									</TableRow>
								</TableHeader>
								<TableBody>
									{nodes.map((node) => (
										<TableRow key={node.id}>
											<TableCell className="font-medium">{node.name}</TableCell>
											<TableCell className="font-mono">{node.ip}</TableCell>
											<TableCell>{node.path}</TableCell>
											<TableCell>{node.maxClients}</TableCell>
											<TableCell>
												{node.isOnline ? (
													<Badge>Online</Badge>
												) : (
													<Badge variant="secondary">Offline</Badge>
												)}
											</TableCell>
											<TableCell className="text-right">
												<div className="flex justify-end gap-1">
													<Button variant="ghost" size="icon-xs" onClick={() => setEditNode(node)}>
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
																<AlertDialogTitle>Remove node?</AlertDialogTitle>
																<AlertDialogDescription>
																	This will remove "{node.name}" from the storage group.
																</AlertDialogDescription>
															</AlertDialogHeader>
															<AlertDialogFooter>
																<AlertDialogCancel>Cancel</AlertDialogCancel>
																<AlertDialogAction onClick={() => deleteNodeMutation.mutate(node.id)}>
																	Remove
																</AlertDialogAction>
															</AlertDialogFooter>
														</AlertDialogContent>
													</AlertDialog>
												</div>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						)}
					</CardContent>
				</Card>
			</div>

			{/* Create Group Dialog */}
			<Dialog open={createGroupOpen} onOpenChange={setCreateGroupOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>New Storage Group</DialogTitle>
					</DialogHeader>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							void groupForm.handleSubmit();
						}}
					>
						<FieldGroup>
							<groupForm.Field name="name">
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
							</groupForm.Field>
							<groupForm.Field name="description">
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
							</groupForm.Field>
						</FieldGroup>
						<DialogFooter className="mt-4">
							<Button type="button" variant="outline" onClick={() => setCreateGroupOpen(false)}>Cancel</Button>
							<groupForm.Subscribe selector={(s) => s.isSubmitting}>
								{(isSubmitting) => (
									<Button type="submit" disabled={isSubmitting}>
										{isSubmitting ? "Creating…" : "Create"}
									</Button>
								)}
							</groupForm.Subscribe>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			{/* Create Node Dialog */}
			<Dialog open={createNodeOpen} onOpenChange={setCreateNodeOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Add Node</DialogTitle>
					</DialogHeader>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							void nodeForm.handleSubmit();
						}}
					>
						<NodeFormFields formInstance={nodeForm} />
						<DialogFooter className="mt-4">
							<Button type="button" variant="outline" onClick={() => setCreateNodeOpen(false)}>Cancel</Button>
							<nodeForm.Subscribe selector={(s) => s.isSubmitting}>
								{(isSubmitting) => (
									<Button type="submit" disabled={isSubmitting}>
										{isSubmitting ? "Adding…" : "Add Node"}
									</Button>
								)}
							</nodeForm.Subscribe>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			{/* Edit Node Dialog */}
			<Dialog open={!!editNode} onOpenChange={(o) => !o && setEditNode(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Edit Node</DialogTitle>
					</DialogHeader>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							void editNodeForm.handleSubmit();
						}}
					>
						<NodeFormFields formInstance={editNodeForm as typeof nodeForm} />
						<DialogFooter className="mt-4">
							<Button type="button" variant="outline" onClick={() => setEditNode(null)}>Cancel</Button>
							<editNodeForm.Subscribe selector={(s) => s.isSubmitting}>
								{(isSubmitting) => (
									<Button type="submit" disabled={isSubmitting}>
										{isSubmitting ? "Saving…" : "Save"}
									</Button>
								)}
							</editNodeForm.Subscribe>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	);
}
