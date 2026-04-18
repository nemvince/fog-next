import { type Host, type Task, hostsApi, imagesApi, tasksApi } from "@/api/client";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { toast } from "@/components/ui/Toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Download, HardDrive, Plus, Trash2, Upload, Wifi, WifiOff } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

type Tab = "info" | "macs" | "inventory" | "tasks";

export function HostDetailPage() {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const qc = useQueryClient();
	const [tab, setTab] = useState<Tab>("info");
	const [newMac, setNewMac] = useState("");
	const [macDesc, setMacDesc] = useState("");

	const { data: host, isLoading } = useQuery({
		queryKey: ["hosts", id],
		queryFn: () => hostsApi.get(id as string),
		enabled: !!id,
	});

	const { data: macsData } = useQuery({
		queryKey: ["hosts", id, "macs"],
		queryFn: () => hostsApi.listMACs(id as string),
		enabled: !!id && tab === "macs",
	});

	const { data: inventory } = useQuery({
		queryKey: ["hosts", id, "inventory"],
		queryFn: () => hostsApi.getInventory(id as string),
		enabled: !!id && tab === "inventory",
	});

	const [form, setForm] = useState<Partial<Host>>({});
	const dirty = Object.keys(form).length > 0;

	const updateMutation = useMutation({
		mutationFn: () => hostsApi.update(id as string, form),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: ["hosts", id] });
			void qc.invalidateQueries({ queryKey: ["hosts"] });
			setForm({});
			toast("Host saved", { variant: "success" });
		},
		onError: (e: Error) => toast(e.message, { variant: "destructive" }),
	});

	const addMacMutation = useMutation({
		mutationFn: () => hostsApi.addMAC(id as string, newMac, macDesc),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: ["hosts", id, "macs"] });
			setNewMac("");
			setMacDesc("");
			toast("MAC address added", { variant: "success" });
		},
		onError: (e: Error) => toast(e.message, { variant: "destructive" }),
	});

	const deleteMacMutation = useMutation({
		mutationFn: (macId: string) => hostsApi.deleteMAC(id as string, macId),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: ["hosts", id, "macs"] });
			toast("MAC address removed");
		},
		onError: (e: Error) => toast(e.message, { variant: "destructive" }),
	});

	// ── Task management ──────────────────────────────────────────
	const { data: activeTask, isLoading: taskLoading } = useQuery({
		queryKey: ["hosts", id, "task"],
		queryFn: () => hostsApi.getActiveTask(id as string),
		enabled: !!id && tab === "tasks",
		refetchInterval: tab === "tasks" ? 5_000 : false,
	});

	const { data: imagesData } = useQuery({
		queryKey: ["images"],
		queryFn: () => imagesApi.list(),
		enabled: tab === "tasks",
	});

	const createTaskMutation = useMutation({
		mutationFn: (payload: Partial<Task>) => tasksApi.create(payload),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: ["hosts", id, "task"] });
			void qc.invalidateQueries({ queryKey: ["tasks"] });
			toast("Task created", { variant: "success" });
		},
		onError: (e: Error) => toast(e.message, { variant: "destructive" }),
	});

	const cancelTaskMutation = useMutation({
		mutationFn: (taskId: string) => tasksApi.cancel(taskId),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: ["hosts", id, "task"] });
			void qc.invalidateQueries({ queryKey: ["tasks"] });
			toast("Task canceled");
		},
		onError: (e: Error) => toast(e.message, { variant: "destructive" }),
	});

	if (isLoading || !host) {
		return (
			<div className="p-8 flex items-center justify-center text-gray-400">
				{isLoading ? "Loading…" : "Host not found."}
			</div>
		);
	}

	const field = <K extends keyof Host>(key: K) => ({
		value: (form[key] ?? host[key] ?? "") as string,
		onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
			setForm((f) => ({ ...f, [key]: e.target.value })),
	});

	const boolField = (key: keyof Host) => ({
		checked: (form[key] ?? host[key]) as boolean,
		onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
			setForm((f) => ({ ...f, [key]: e.target.checked })),
	});

	const macs = macsData?.data ?? [];

	return (
		<div className="p-8 max-w-3xl">
			{/* Header */}
			<div className="mb-6 flex items-center gap-4">
				<button
					type="button"
					onClick={() => navigate("/hosts")}
					className="text-gray-400 hover:text-gray-100 transition-colors"
				>
					<ArrowLeft className="h-5 w-5" />
				</button>
				<div>
					<h1 className="text-2xl font-bold">{host.name}</h1>
					<p className="text-sm text-gray-400">{host.ip}</p>
				</div>
				<div className="ml-auto flex items-center gap-2">
					{host.lastContact ? (
						<Badge variant="success">
							<Wifi className="mr-1 h-3 w-3" />
							Online
						</Badge>
					) : (
						<Badge variant="outline">
							<WifiOff className="mr-1 h-3 w-3" />
							Never seen
						</Badge>
					)}
					<Badge variant={host.isEnabled ? "default" : "outline"}>
						{host.isEnabled ? "Enabled" : "Disabled"}
					</Badge>
				</div>
			</div>

			{/* Tabs */}
			<div className="mb-6 flex gap-1 border-b border-gray-800">
				{(["info", "macs", "inventory", "tasks"] as Tab[]).map((t) => (
					<button
						type="button"
						key={t}
						onClick={() => setTab(t)}
						className={`px-4 py-2 text-sm font-medium transition-colors capitalize
              ${
								tab === t
									? "border-b-2 border-blue-500 text-blue-400"
									: "text-gray-400 hover:text-gray-100"
							}`}
					>
						{t === "macs"
							? "MAC Addresses"
							: t === "tasks"
								? "Tasks"
								: t.charAt(0).toUpperCase() + t.slice(1)}
					</button>
				))}
			</div>

			{/* Info tab */}
			{tab === "info" && (
				<form
					onSubmit={(e) => {
						e.preventDefault();
						updateMutation.mutate();
					}}
					className="flex flex-col gap-4"
				>
					<div className="grid grid-cols-2 gap-4">
						<Input label="Name" {...field("name")} required />
						<Input label="IP Address" {...field("ip")} />
					</div>
					<Input label="Description" {...field("description")} />
					<div className="grid grid-cols-2 gap-4">
						<Input label="Kernel" {...field("kernel")} />
						<Input label="Init" {...field("init")} />
					</div>
					<Input label="Kernel Arguments" {...field("kernelArgs")} />

					<div className="flex gap-6 mt-2">
						{(["isEnabled", "useAad", "useWol"] as const).map((key) => (
							<label
								key={key}
								className="flex items-center gap-2 cursor-pointer select-none"
							>
								<input
									type="checkbox"
									className="h-4 w-4 accent-blue-500"
									{...boolField(key)}
								/>
								<span className="text-sm text-gray-300">
									{key === "isEnabled"
										? "Enabled"
										: key === "useAad"
											? "Use AAD"
											: "Use WoL"}
								</span>
							</label>
						))}
					</div>

					{host.lastContact && (
						<p className="text-xs text-gray-500">
							Last contact: {new Date(host.lastContact).toLocaleString()}
						</p>
					)}

					<div className="flex justify-end">
						<Button type="submit" disabled={!dirty || updateMutation.isPending}>
							Save Changes
						</Button>
					</div>
				</form>
			)}

			{/* MACs tab */}
			{tab === "macs" && (
				<div className="flex flex-col gap-4">
					<div className="rounded-lg border border-gray-800 bg-gray-900 divide-y divide-gray-800">
						{macs.length === 0 && (
							<p className="p-4 text-sm text-gray-500">
								No MAC addresses registered.
							</p>
						)}
						{macs.map((m) => (
							<div
								key={m.id}
								className="flex items-center justify-between px-4 py-3"
							>
								<div>
									<p className="font-mono text-sm text-gray-100">{m.mac}</p>
									{m.description && (
										<p className="text-xs text-gray-500">{m.description}</p>
									)}
								</div>
								<div className="flex items-center gap-2">
									{m.isPrimary && <Badge variant="default">Primary</Badge>}
									{m.isIgnored && <Badge variant="warning">Ignored</Badge>}
									<Button
										variant="ghost"
										size="icon"
										onClick={() => deleteMacMutation.mutate(m.id)}
									>
										<Trash2 className="h-4 w-4 text-red-400" />
									</Button>
								</div>
							</div>
						))}
					</div>

					{/* Add MAC form */}
					<form
						onSubmit={(e) => {
							e.preventDefault();
							addMacMutation.mutate();
						}}
						className="flex gap-2 items-end"
					>
						<Input
							label="MAC Address"
							value={newMac}
							onChange={(e) => setNewMac(e.target.value)}
							placeholder="aa:bb:cc:dd:ee:ff"
							required
						/>
						<Input
							label="Description (optional)"
							value={macDesc}
							onChange={(e) => setMacDesc(e.target.value)}
						/>
						<Button
							type="submit"
							disabled={addMacMutation.isPending}
							className="mb-0.5"
						>
							<Plus className="h-4 w-4" /> Add
						</Button>
					</form>
				</div>
			)}

			{/* Inventory tab */}
			{tab === "inventory" && (
				<div className="rounded-lg border border-gray-800 bg-gray-900 divide-y divide-gray-800">
					{!inventory ? (
						<p className="p-4 text-sm text-gray-500">
							No inventory data collected yet.
						</p>
					) : (
						[
							["Manufacturer", inventory.manufacturer],
							["Product", inventory.product],
							["Serial", inventory.serial],
							["UUID", inventory.uuid],
							[
								"CPU",
								`${inventory.cpuModel} (${inventory.cpuCores} cores @ ${inventory.cpuFreqMhz} MHz)`,
							],
							["RAM", `${inventory.ramMib} MiB`],
							["Storage", `${inventory.hdModel} — ${inventory.hdSizeGb} GB`],
							["BIOS", inventory.biosVersion],
							["OS", inventory.osName],
						].map(([label, value]) => (
							<div key={label} className="flex items-center px-4 py-3 gap-4">
								<span className="w-28 shrink-0 text-xs text-gray-400">
									{label}
								</span>
								<span className="text-sm text-gray-100">{value || "—"}</span>
							</div>
						))
					)}
				</div>
			)}

			{/* Tasks tab */}
			{tab === "tasks" && (
				<div className="flex flex-col gap-6">
					{/* Active task */}
					{taskLoading ? (
						<p className="text-sm text-gray-400">Loading…</p>
					) : activeTask ? (
						<div className="rounded-lg border border-gray-800 bg-gray-900 p-4 flex flex-col gap-3">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<HardDrive className="h-4 w-4 text-blue-400" />
									<span className="text-sm font-medium text-gray-100 capitalize">
										{activeTask.type.replace("_", " ")} — {activeTask.state}
									</span>
								</div>
								{["active", "queued"].includes(activeTask.state) && (
									<Button
										variant="outline"
										size="sm"
										onClick={() => cancelTaskMutation.mutate(activeTask.id)}
									>
										Cancel
									</Button>
								)}
							</div>
							{activeTask.state === "active" && (
								<div className="flex items-center gap-3">
									<div className="h-2 flex-1 rounded-full bg-gray-700">
										<div
											className="h-2 rounded-full bg-blue-500 transition-all"
											style={{ width: `${Math.min(activeTask.percentComplete, 100)}%` }}
										/>
									</div>
									<span className="text-xs text-gray-400 w-10 text-right">
										{activeTask.percentComplete}%
									</span>
								</div>
							)}
						</div>
					) : (
						<p className="text-sm text-gray-500">No active task.</p>
					)}

					{/* Quick actions */}
					<div>
						<h3 className="text-sm font-medium text-gray-400 mb-3">Quick Actions</h3>
						<div className="flex flex-wrap gap-2">
							<Button
								onClick={() =>
									createTaskMutation.mutate({ hostId: id as string, type: "deploy" })
								}
								disabled={!!activeTask || createTaskMutation.isPending}
							>
								<Download className="h-4 w-4" /> Deploy
							</Button>
							<Button
								variant="outline"
								onClick={() =>
									createTaskMutation.mutate({ hostId: id as string, type: "capture" })
								}
								disabled={!!activeTask || createTaskMutation.isPending}
							>
								<Upload className="h-4 w-4" /> Capture
							</Button>
							<Button
								variant="outline"
								onClick={() =>
									createTaskMutation.mutate({ hostId: id as string, type: "debug_deploy" })
								}
								disabled={!!activeTask || createTaskMutation.isPending}
							>
								Debug
							</Button>
							<Button
								variant="outline"
								onClick={() =>
									createTaskMutation.mutate({ hostId: id as string, type: "memtest" })
								}
								disabled={!!activeTask || createTaskMutation.isPending}
							>
								Memtest
							</Button>
						</div>
					</div>

					{/* Image assignment */}
					<div>
						<h3 className="text-sm font-medium text-gray-400 mb-3">Assigned Image</h3>
						<select
							value={form.imageId ?? host.imageId ?? ""}
							onChange={(e) =>
								setForm((f) => ({
									...f,
									imageId: e.target.value || undefined,
								}))
							}
							className="rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 w-full max-w-sm"
						>
							<option value="">No image assigned</option>
							{(imagesData?.data ?? []).map((img) => (
								<option key={img.id} value={img.id}>{img.name}</option>
							))}
						</select>
						{form.imageId !== undefined && form.imageId !== host.imageId && (
							<div className="mt-2">
								<Button
									size="sm"
									onClick={() => updateMutation.mutate()}
									disabled={updateMutation.isPending}
								>
									Save Image Assignment
								</Button>
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
