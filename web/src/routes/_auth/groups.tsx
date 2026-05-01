import { Plus, Trash } from "@phosphor-icons/react";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import * as z from "zod";
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
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import type { Group, GroupMember, Host, Paginated } from "@/types";

export const Route = createFileRoute("/_auth/groups")({
	component: GroupsPage,
});

const groupSchema = z.object({
	name: z.string().min(1, "Name is required"),
	description: z.string(),
});

function GroupsPage() {
	const qc = useQueryClient();
	const [createOpen, setCreateOpen] = useState(false);
	const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
	const [addMemberOpen, setAddMemberOpen] = useState(false);
	const [addMemberHostId, setAddMemberHostId] = useState<string | null>("");

	const groupsQuery = useQuery({
		queryKey: ["groups"],
		queryFn: () => api.get<Paginated<Group>>("/groups?page=1&limit=1000"),
	});

	const membersQuery = useQuery({
		queryKey: ["group-members", selectedGroup?.id],
		queryFn: () =>
			// biome-ignore lint/style/noNonNullAssertion: enabled only when selectedGroup is set
			api.get<{ data: GroupMember[] }>(`/groups/${selectedGroup!.id}/members`),
		enabled: !!selectedGroup,
	});

	const hostsQuery = useQuery({
		queryKey: ["hosts", "all"],
		queryFn: () => api.get<Paginated<Host>>("/hosts?page=1&limit=1000"),
	});

	const createMutation = useMutation({
		mutationFn: (values: z.infer<typeof groupSchema>) =>
			api.post<Group>("/groups", values),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: ["groups"] });
			setCreateOpen(false);
			toast.success("Group created");
		},
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : "Failed"),
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => api.del<void>(`/groups/${id}`),
		onSuccess: (_, id) => {
			void qc.invalidateQueries({ queryKey: ["groups"] });
			if (selectedGroup?.id === id) setSelectedGroup(null);
			toast.success("Group deleted");
		},
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : "Failed"),
	});

	const addMemberMutation = useMutation({
		mutationFn: (hostId: string) =>
			// biome-ignore lint/style/noNonNullAssertion: mutates only when selectedGroup is set
			api.post<void>(`/groups/${selectedGroup!.id}/members`, { hostId }),
		onSuccess: () => {
			void qc.invalidateQueries({
				queryKey: ["group-members", selectedGroup?.id],
			});
			setAddMemberOpen(false);
			setAddMemberHostId("");
			toast.success("Member added");
		},
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : "Failed"),
	});

	const removeMemberMutation = useMutation({
		mutationFn: (hostId: string) =>
			// biome-ignore lint/style/noNonNullAssertion: mutates only when selectedGroup is set
			api.del<void>(`/groups/${selectedGroup!.id}/members/${hostId}`),
		onSuccess: () => {
			void qc.invalidateQueries({
				queryKey: ["group-members", selectedGroup?.id],
			});
			toast.success("Member removed");
		},
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : "Failed"),
	});

	const form = useForm({
		defaultValues: { name: "", description: "" },
		validators: { onSubmit: groupSchema },
		onSubmit: ({ value }) => createMutation.mutate(value),
	});

	const groups = groupsQuery.data?.data ?? [];
	const members = membersQuery.data?.data ?? [];

	// Hosts not already in the group
	const allHosts = hostsQuery.data?.data ?? [];
	const memberHostIds = new Set(members.map((m) => m.hostId));
	const availableHosts = allHosts.filter((h) => !memberHostIds.has(h.id));

	return (
		<div className="flex flex-col gap-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold">Groups</h1>
					<p className="text-muted-foreground">Organize hosts into groups</p>
				</div>
				<Button onClick={() => setCreateOpen(true)}>
					<Plus data-icon="inline-start" />
					New Group
				</Button>
			</div>

			<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
				{/* Group list */}
				<Card className="md:col-span-1">
					<CardHeader>
						<CardTitle>Groups</CardTitle>
					</CardHeader>
					<CardContent className="p-0">
						{groups.length === 0 ? (
							<p className="px-4 py-6 text-sm text-muted-foreground">
								No groups
							</p>
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
												{group.description && (
													<div className="text-xs text-muted-foreground">
														{group.description}
													</div>
												)}
											</TableCell>
											<TableCell className="text-right">
												<AlertDialog>
													<AlertDialogTrigger
														render={
															<Button
																variant="ghost"
																size="icon-xs"
																onClick={(e) => e.stopPropagation()}
															>
																<Trash />
															</Button>
														}
													/>
													<AlertDialogContent>
														<AlertDialogHeader>
															<AlertDialogTitle>Delete group?</AlertDialogTitle>
															<AlertDialogDescription>
																This will delete "{group.name}".
															</AlertDialogDescription>
														</AlertDialogHeader>
														<AlertDialogFooter>
															<AlertDialogCancel>Cancel</AlertDialogCancel>
															<AlertDialogAction
																onClick={() => deleteMutation.mutate(group.id)}
															>
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

				{/* Members panel */}
				<Card className="md:col-span-2">
					<CardHeader className="flex flex-row items-center justify-between">
						<div>
							<CardTitle>
								{selectedGroup ? selectedGroup.name : "Members"}
							</CardTitle>
							<CardDescription>
								{selectedGroup
									? "Hosts in this group"
									: "Select a group to view members"}
							</CardDescription>
						</div>
						{selectedGroup && (
							<Button size="sm" onClick={() => setAddMemberOpen(true)}>
								<Plus data-icon="inline-start" />
								Add Host
							</Button>
						)}
					</CardHeader>
					<CardContent>
						{!selectedGroup ? null : membersQuery.isLoading ? (
							<p className="text-sm text-muted-foreground">Loading…</p>
						) : members.length === 0 ? (
							<p className="text-sm text-muted-foreground">No members</p>
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Host</TableHead>
										<TableHead />
									</TableRow>
								</TableHeader>
								<TableBody>
									{members.map((member) => {
										const host = allHosts.find((h) => h.id === member.hostId);
										return (
											<TableRow key={member.hostId}>
												<TableCell>{host?.name ?? member.hostId}</TableCell>
												<TableCell className="text-right">
													<Button
														variant="ghost"
														size="icon-xs"
														onClick={() =>
															removeMemberMutation.mutate(member.hostId)
														}
													>
														<Trash />
													</Button>
												</TableCell>
											</TableRow>
										);
									})}
								</TableBody>
							</Table>
						)}
					</CardContent>
				</Card>
			</div>

			{/* Create Group Dialog */}
			<Dialog open={createOpen} onOpenChange={setCreateOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>New Group</DialogTitle>
					</DialogHeader>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							void form.handleSubmit();
						}}
					>
						<FieldGroup>
							<form.Field name="name">
								{(field) => {
									const isInvalid =
										field.state.meta.isTouched && !field.state.meta.isValid;
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
											{isInvalid && (
												<FieldError errors={field.state.meta.errors} />
											)}
										</Field>
									);
								}}
							</form.Field>
							<form.Field name="description">
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
							</form.Field>
						</FieldGroup>
						<DialogFooter className="mt-4">
							<Button
								type="button"
								variant="outline"
								onClick={() => setCreateOpen(false)}
							>
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

			{/* Add Member Dialog */}
			<Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Add Host to Group</DialogTitle>
					</DialogHeader>
					<div className="flex flex-col gap-4">
						<Field>
							<FieldLabel>Host</FieldLabel>
							<Select
								value={addMemberHostId}
								onValueChange={setAddMemberHostId}
							>
								<SelectTrigger>
									<SelectValue placeholder="Select host" />
								</SelectTrigger>
								<SelectContent>
									{availableHosts.map((h) => (
										<SelectItem key={h.id} value={h.id}>
											{h.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
					</div>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => setAddMemberOpen(false)}
						>
							Cancel
						</Button>
						<Button
							disabled={!addMemberHostId || addMemberMutation.isPending}
							onClick={() =>
								addMemberHostId && addMemberMutation.mutate(addMemberHostId)
							}
						>
							{addMemberMutation.isPending ? "Adding…" : "Add"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
