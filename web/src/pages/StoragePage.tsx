import { storageApi } from "@/api/client";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { toast } from "@/components/ui/Toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Database, Plus, Server, Trash2 } from "lucide-react";
import { useState } from "react";

export function StoragePage() {
	const qc = useQueryClient();
	const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
	const [groupDialog, setGroupDialog] = useState(false);
	const [nodeDialog, setNodeDialog] = useState(false);
	const [groupForm, setGroupForm] = useState({ name: "", description: "" });
	const [nodeForm, setNodeForm] = useState({
		name: "",
		hostname: "",
		rootPath: "",
		isMaster: false,
	});

	const { data: groupsData, isLoading: groupsLoading } = useQuery({
		queryKey: ["storage-groups"],
		queryFn: () => storageApi.listGroups(),
	});

	const groups = groupsData?.data ?? [];

	const { data: nodesData } = useQuery({
		queryKey: ["storage-nodes", selectedGroup],
		queryFn: () => storageApi.listNodes(selectedGroup as string),
		enabled: !!selectedGroup,
	});

	const createGroup = useMutation({
		mutationFn: () => storageApi.createGroup(groupForm),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: ["storage-groups"] });
			setGroupDialog(false);
			setGroupForm({ name: "", description: "" });
			toast("Storage group created", { variant: "success" });
		},
		onError: (e: Error) => toast(e.message, { variant: "destructive" }),
	});

	const deleteGroup = useMutation({
		mutationFn: (id: string) => storageApi.deleteGroup(id),
		onSuccess: (_, variables) => {
			void qc.invalidateQueries({ queryKey: ["storage-groups"] });
			if (selectedGroup === variables) setSelectedGroup(null);
			toast("Group deleted");
		},
		onError: (e: Error) => toast(e.message, { variant: "destructive" }),
	});

	const createNode = useMutation({
		mutationFn: () => storageApi.createNode(selectedGroup as string, nodeForm),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: ["storage-nodes", selectedGroup] });
			setNodeDialog(false);
			setNodeForm({ name: "", hostname: "", rootPath: "", isMaster: false });
			toast("Storage node created", { variant: "success" });
		},
		onError: (e: Error) => toast(e.message, { variant: "destructive" }),
	});

	const deleteNode = useMutation({
		mutationFn: (id: string) => storageApi.deleteNode(id),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: ["storage-nodes", selectedGroup] });
			toast("Node deleted");
		},
		onError: (e: Error) => toast(e.message, { variant: "destructive" }),
	});

	return (
		<div className="p-8">
			<h1 className="mb-6 text-2xl font-bold">Storage</h1>

			<div className="grid grid-cols-2 gap-4">
				{/* Groups panel */}
				<div>
					<div className="mb-3 flex items-center justify-between">
						<h2 className="font-semibold text-gray-300">Groups</h2>
						<Button size="sm" onClick={() => setGroupDialog(true)}>
							<Plus className="h-3 w-3" /> Add
						</Button>
					</div>
					{groupsLoading ? (
						<p className="text-gray-500 text-sm">Loading…</p>
					) : groups.length === 0 ? (
						<p className="text-gray-500 text-sm">No groups</p>
					) : (
						<div className="flex flex-col gap-2">
							{groups.map((g) => (
								<button
									type="button"
									key={g.id}
									onClick={() => setSelectedGroup(g.id)}
									className={`flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
										selectedGroup === g.id
											? "border-blue-600 bg-blue-600/10"
											: "border-gray-800 bg-gray-900 hover:border-gray-700"
									}`}
								>
									<Database className="h-4 w-4 text-blue-400" />
									<div className="flex-1 min-w-0">
										<p className="font-medium text-sm text-gray-100">
											{g.name}
										</p>
										{g.description && (
											<p className="text-xs text-gray-500 truncate">
												{g.description}
											</p>
										)}
									</div>
									<Button
										variant="ghost"
										size="icon"
										onClick={(e) => {
											e.stopPropagation();
											deleteGroup.mutate(g.id);
										}}
									>
										<Trash2 className="h-3 w-3 text-red-400" />
									</Button>
								</button>
							))}
						</div>
					)}
				</div>

				{/* Nodes panel */}
				<div>
					<div className="mb-3 flex items-center justify-between">
						<h2 className="font-semibold text-gray-300">Nodes</h2>
						{selectedGroup && (
							<Button size="sm" onClick={() => setNodeDialog(true)}>
								<Plus className="h-3 w-3" /> Add
							</Button>
						)}
					</div>
					{!selectedGroup ? (
						<p className="text-gray-500 text-sm">
							Select a group to view nodes
						</p>
					) : (nodesData?.data ?? []).length === 0 ? (
						<p className="text-gray-500 text-sm">No nodes in this group</p>
					) : (
						<div className="flex flex-col gap-2">
							{(nodesData?.data ?? []).map((n) => (
								<div
									key={n.id}
									className="flex items-center gap-3 rounded-lg border border-gray-800 bg-gray-900 px-4 py-3"
								>
									<Server className="h-4 w-4 text-gray-400" />
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2">
											<p className="font-medium text-sm text-gray-100">
												{n.name}
											</p>
											{n.isMaster && <Badge variant="default">master</Badge>}
											{!n.isEnabled && (
												<Badge variant="outline">disabled</Badge>
											)}
										</div>
										<p className="text-xs text-gray-500">
											{n.hostname}
											{n.rootPath}
										</p>
									</div>
									<Button
										variant="ghost"
										size="icon"
										onClick={() => deleteNode.mutate(n.id)}
									>
										<Trash2 className="h-3 w-3 text-red-400" />
									</Button>
								</div>
							))}
						</div>
					)}
				</div>
			</div>

			{/* Group dialog */}
			<Dialog open={groupDialog} onOpenChange={setGroupDialog}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle className="text-lg font-semibold text-gray-100">
							Add Storage Group
						</DialogTitle>
					</DialogHeader>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							createGroup.mutate();
						}}
						className="flex flex-col gap-4"
					>
						<Input
							label="Name"
							value={groupForm.name}
							onChange={(e) =>
								setGroupForm({ ...groupForm, name: e.target.value })
							}
							required
						/>
						<Input
							label="Description"
							value={groupForm.description}
							onChange={(e) =>
								setGroupForm({ ...groupForm, description: e.target.value })
							}
						/>
						<div className="flex justify-end gap-2">
							<Button
								type="button"
								variant="outline"
								onClick={() => setGroupDialog(false)}
							>
								Cancel
							</Button>
							<Button type="submit" disabled={createGroup.isPending}>
								Create
							</Button>
						</div>
					</form>
				</DialogContent>
			</Dialog>

			{/* Node dialog */}
			<Dialog open={nodeDialog} onOpenChange={setNodeDialog}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle className="text-lg font-semibold text-gray-100">
							Add Storage Node
						</DialogTitle>
					</DialogHeader>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							createNode.mutate();
						}}
						className="flex flex-col gap-4"
					>
						<Input
							label="Name"
							value={nodeForm.name}
							onChange={(e) =>
								setNodeForm({ ...nodeForm, name: e.target.value })
							}
							required
						/>
						<Input
							label="Hostname / IP"
							value={nodeForm.hostname}
							onChange={(e) =>
								setNodeForm({ ...nodeForm, hostname: e.target.value })
							}
							required
						/>
						<Input
							label="Storage path"
							value={nodeForm.rootPath}
							onChange={(e) =>
								setNodeForm({ ...nodeForm, rootPath: e.target.value })
							}
							required
						/>
						<label className="flex items-center gap-2 text-sm text-gray-300">
							<input
								type="checkbox"
								checked={nodeForm.isMaster}
								onChange={(e) =>
									setNodeForm({ ...nodeForm, isMaster: e.target.checked })
								}
							/>
							Master node
						</label>
						<div className="flex justify-end gap-2">
							<Button
								type="button"
								variant="outline"
								onClick={() => setNodeDialog(false)}
							>
								Cancel
							</Button>
							<Button type="submit" disabled={createNode.isPending}>
								Create
							</Button>
						</div>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	);
}
