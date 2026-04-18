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
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import type { Paginated, User } from "@/types";
import { Copy, Pencil, Plus, Trash } from "@phosphor-icons/react";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import * as z from "zod";

export const Route = createFileRoute("/_auth/users")({
	component: UsersPage,
});

const createSchema = z.object({
	username: z.string().min(1, "Username is required"),
	password: z.string().min(8, "Password must be at least 8 characters"),
	role: z.enum(["admin", "readonly"]),
});

const editSchema = z.object({
	username: z.string().min(1, "Username is required"),
	password: z.string(),
	role: z.enum(["admin", "readonly"]),
});

function UsersPage() {
	const qc = useQueryClient();
	const [createOpen, setCreateOpen] = useState(false);
	const [editTarget, setEditTarget] = useState<User | null>(null);
	const [apiToken, setApiToken] = useState<string | null>(null);

	const { data, isLoading } = useQuery({
		queryKey: ["users"],
		queryFn: () => api.get<Paginated<User>>("/users?page=1&limit=1000"),
	});

	const createMutation = useMutation({
		mutationFn: (values: z.infer<typeof createSchema>) => api.post<User>("/users", values),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: ["users"] });
			setCreateOpen(false);
			toast.success("User created");
		},
		onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
	});

	const updateMutation = useMutation({
		mutationFn: ({ id, values }: { id: string; values: z.infer<typeof editSchema> }) => {
			const body: Record<string, unknown> = {
				username: values.username,
				role: values.role,
			};
			if (values.password) body.password = values.password;
			return api.put<User>(`/users/${id}`, body);
		},
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: ["users"] });
			setEditTarget(null);
			toast.success("User updated");
		},
		onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => api.del<void>(`/users/${id}`),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: ["users"] });
			toast.success("User deleted");
		},
		onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
	});

	const regenTokenMutation = useMutation({
		mutationFn: (id: string) => api.post<{ token: string }>(`/users/${id}/token`, {}),
		onSuccess: (res) => setApiToken(res.token),
		onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
	});

	const createForm = useForm({
		defaultValues: { username: "", password: "", role: "readonly" as "admin" | "readonly" },
		validators: { onSubmit: createSchema },
		onSubmit: ({ value }) => createMutation.mutate(value),
	});

	const editForm = useForm({
		defaultValues: {
			username: editTarget?.username ?? "",
			password: "",
			role: (editTarget?.role ?? "readonly") as "admin" | "readonly",
		},
		validators: { onSubmit: editSchema },
		onSubmit: ({ value }) => {
			if (editTarget) updateMutation.mutate({ id: editTarget.id, values: value });
		},
	});

	const users = data?.data ?? [];

	function UserFormFields({
		formInstance,
		isCreate,
	}: {
		formInstance: typeof createForm;
		isCreate: boolean;
	}) {
		return (
			<FieldGroup>
				<formInstance.Field name="username">
					{(field) => {
						const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
						return (
							<Field data-invalid={isInvalid}>
								<FieldLabel htmlFor={field.name}>Username</FieldLabel>
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
				<formInstance.Field name="password">
					{(field) => {
						const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
						return (
							<Field data-invalid={isInvalid}>
								<FieldLabel htmlFor={field.name}>
									{isCreate ? "Password" : "New Password (leave blank to keep)"}
								</FieldLabel>
								<Input
									id={field.name}
									name={field.name}
									type="password"
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
				<formInstance.Field name="role">
					{(field) => (
						<Field>
							<FieldLabel>Role</FieldLabel>
							<RadioGroup
								value={field.state.value}
								onValueChange={(v) => field.handleChange(v as "admin" | "readonly")}
							>
								<div className="flex items-center gap-2">
									<RadioGroupItem value="admin" id="role-admin" />
									<Label htmlFor="role-admin">Admin</Label>
								</div>
								<div className="flex items-center gap-2">
									<RadioGroupItem value="readonly" id="role-readonly" />
									<Label htmlFor="role-readonly">Read Only</Label>
								</div>
							</RadioGroup>
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
					<h1 className="text-2xl font-bold">Users</h1>
					<p className="text-muted-foreground">Manage user accounts</p>
				</div>
				<Button onClick={() => setCreateOpen(true)}>
					<Plus data-icon="inline-start" />
					Add User
				</Button>
			</div>

			<div className="rounded-lg border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Username</TableHead>
							<TableHead>Role</TableHead>
							<TableHead>Last Login</TableHead>
							<TableHead />
						</TableRow>
					</TableHeader>
					<TableBody>
						{isLoading ? (
							<TableRow>
								<TableCell colSpan={4} className="text-center text-muted-foreground py-8">Loading…</TableCell>
							</TableRow>
						) : users.length === 0 ? (
							<TableRow>
								<TableCell colSpan={4} className="text-center text-muted-foreground py-8">No users</TableCell>
							</TableRow>
						) : (
							users.map((user) => (
								<TableRow key={user.id}>
									<TableCell className="font-medium">{user.username}</TableCell>
									<TableCell>
										<Badge variant={user.role === "admin" ? "default" : "secondary"}>
											{user.role}
										</Badge>
									</TableCell>
									<TableCell className="text-muted-foreground text-sm">
										{user.lastLogin ? new Date(user.lastLogin).toLocaleString() : "Never"}
									</TableCell>
									<TableCell className="text-right">
										<div className="flex justify-end gap-1">
											<Button
												variant="ghost"
												size="icon-xs"
												title="Regenerate API token"
												onClick={() => regenTokenMutation.mutate(user.id)}
											>
												<Copy />
											</Button>
											<Button variant="ghost" size="icon-xs" onClick={() => setEditTarget(user)}>
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
														<AlertDialogTitle>Delete user?</AlertDialogTitle>
														<AlertDialogDescription>
															This will permanently delete "{user.username}".
														</AlertDialogDescription>
													</AlertDialogHeader>
													<AlertDialogFooter>
														<AlertDialogCancel>Cancel</AlertDialogCancel>
														<AlertDialogAction onClick={() => deleteMutation.mutate(user.id)}>
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

			{/* Create Dialog */}
			<Dialog open={createOpen} onOpenChange={setCreateOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Add User</DialogTitle>
					</DialogHeader>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							void createForm.handleSubmit();
						}}
					>
						<UserFormFields formInstance={createForm} isCreate />
						<DialogFooter className="mt-4">
							<Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
							<createForm.Subscribe selector={(s) => s.isSubmitting}>
								{(isSubmitting) => (
									<Button type="submit" disabled={isSubmitting}>
										{isSubmitting ? "Creating…" : "Create"}
									</Button>
								)}
							</createForm.Subscribe>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			{/* Edit Dialog */}
			<Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Edit User</DialogTitle>
					</DialogHeader>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							void editForm.handleSubmit();
						}}
					>
						<UserFormFields formInstance={editForm as unknown as typeof createForm} isCreate={false} />
						<DialogFooter className="mt-4">
							<Button type="button" variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
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

			{/* API Token Dialog */}
			<Dialog open={!!apiToken} onOpenChange={(o) => !o && setApiToken(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>API Token</DialogTitle>
					</DialogHeader>
					<p className="text-sm text-muted-foreground">
						Copy this token now — it won't be shown again.
					</p>
					<div className="flex items-center gap-2 rounded-md border bg-muted p-3 font-mono text-sm break-all">
						{apiToken}
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => {
								if (apiToken) void navigator.clipboard.writeText(apiToken);
								toast.success("Copied");
							}}
						>
							<Copy data-icon="inline-start" />
							Copy
						</Button>
						<Button onClick={() => setApiToken(null)}>Done</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
