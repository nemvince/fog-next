import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	createColumnHelper,
	getCoreRowModel,
	useReactTable,
} from "@tanstack/react-table";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { type User, usersApi } from "@/api/client";
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

const col = createColumnHelper<User>();

export function UsersPage() {
	const qc = useQueryClient();
	const [open, setOpen] = useState(false);
	const [form, setForm] = useState({
		username: "",
		password: "",
		role: "readonly",
		email: "",
	});

	const { data, isLoading } = useQuery({
		queryKey: ["users"],
		queryFn: () => usersApi.list(),
	});

	const createMutation = useMutation({
		mutationFn: () =>
			usersApi.create({
				username: form.username,
				password: form.password,
				role: form.role,
				email: form.email,
				isActive: true,
			}),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: ["users"] });
			setOpen(false);
			setForm({ username: "", password: "", role: "readonly", email: "" });
			toast("User created", { variant: "success" });
		},
		onError: (e: Error) => toast(e.message, { variant: "destructive" }),
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => usersApi.delete(id),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: ["users"] });
			toast("User deleted");
		},
		onError: (e: Error) => toast(e.message, { variant: "destructive" }),
	});

	const regenMutation = useMutation({
		mutationFn: (id: string) => usersApi.regenerateToken(id),
		onSuccess: (data) => {
			toast("Token regenerated", {
				description: data.token,
				variant: "success",
			});
		},
		onError: (e: Error) => toast(e.message, { variant: "destructive" }),
	});

	const columns = [
		col.accessor("username", { header: "Username" }),
		col.accessor("role", {
			header: "Role",
			cell: (info) => (
				<Badge variant={info.getValue() === "admin" ? "default" : "outline"}>
					{info.getValue()}
				</Badge>
			),
		}),
		col.accessor("email", { header: "Email" }),
		col.accessor("isActive", {
			header: "Active",
			cell: (info) => (
				<Badge variant={info.getValue() ? "success" : "outline"}>
					{info.getValue() ? "Yes" : "No"}
				</Badge>
			),
		}),
		col.accessor("lastLoginAt", {
			header: "Last Login",
			cell: (info) =>
				info.getValue()
					? new Date(info.getValue() as string).toLocaleString()
					: "Never",
		}),
		col.display({
			id: "actions",
			cell: (info) => (
				<div className="flex gap-1">
					<Button
						variant="ghost"
						size="icon"
						title="Regenerate API token"
						onClick={() => regenMutation.mutate(info.row.original.id)}
					>
						<RefreshCw className="h-4 w-4 text-blue-400" />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						onClick={() => deleteMutation.mutate(info.row.original.id)}
					>
						<Trash2 className="h-4 w-4 text-red-400" />
					</Button>
				</div>
			),
		}),
	];

	const table = useReactTable({
		data: data?.data ?? [],
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	return (
		<div className="p-8">
			<div className="mb-6 flex items-center justify-between">
				<h1 className="text-2xl font-bold">Users</h1>
				<Button onClick={() => setOpen(true)}>
					<Plus className="h-4 w-4" /> New User
				</Button>
			</div>

			<DataTable table={table} isLoading={isLoading} emptyMessage="No users" />

			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle className="text-lg font-semibold text-gray-100">
							Create User
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
							label="Username"
							value={form.username}
							onChange={(e) => setForm({ ...form, username: e.target.value })}
							required
						/>
						<Input
							label="Password"
							type="password"
							value={form.password}
							onChange={(e) => setForm({ ...form, password: e.target.value })}
							required
						/>
						<Input
							label="Email"
							type="email"
							value={form.email}
							onChange={(e) => setForm({ ...form, email: e.target.value })}
						/>
						<div className="flex flex-col gap-1">
							<label htmlFor="role-select" className="text-xs text-gray-400">
								Role
							</label>
							<select
								id="role-select"
								value={form.role}
								onChange={(e) => setForm({ ...form, role: e.target.value })}
								className="rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 outline-none focus:border-blue-500"
							>
								<option value="readonly">Read-only</option>
								<option value="admin">Admin</option>
							</select>
						</div>
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
