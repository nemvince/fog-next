import { type Snapin, snapinsApi } from "@/api/client";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { toast } from "@/components/ui/Toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    createColumnHelper,
    getCoreRowModel,
    useReactTable,
} from "@tanstack/react-table";
import { Trash2, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";

const col = createColumnHelper<Snapin>();

export function SnapinsPage() {
	const qc = useQueryClient();
	const fileRef = useRef<HTMLInputElement>(null);
	const [uploading, setUploading] = useState(false);

	const { data, isLoading } = useQuery({
		queryKey: ["snapins"],
		queryFn: () => snapinsApi.list(),
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => snapinsApi.delete(id),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: ["snapins"] });
			toast("Snapin deleted");
		},
		onError: (e: Error) => toast(e.message, { variant: "destructive" }),
	});

	async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file) return;
		setUploading(true);
		try {
			// First create a snapin record, then upload
			const snapin = await snapinsApi.create({
				name: file.name,
				description: "",
			});
			const fd = new FormData();
			fd.append("file", file);
			const token = localStorage.getItem("fog_token");
			await fetch(`/fog/api/v1/snapins/${snapin.id}/upload`, {
				method: "POST",
				headers: token ? { Authorization: `Bearer ${token}` } : {},
				body: fd,
			});
			void qc.invalidateQueries({ queryKey: ["snapins"] });
			toast("Snapin uploaded", { variant: "success" });
		} catch {
			toast("Upload failed", { variant: "destructive" });
		} finally {
			setUploading(false);
			if (fileRef.current) fileRef.current.value = "";
		}
	}

	const columns = useMemo(() => [
		col.accessor("name", { header: "Name" }),
		col.accessor("fileName", { header: "File" }),
		col.accessor("sizeBytes", {
			header: "Size",
			cell: (info) => {
				const mb = info.getValue() / 1_048_576;
				return info.getValue() ? `${mb.toFixed(1)} MB` : "—";
			},
		}),
		col.accessor("isEnabled", {
			header: "Enabled",
			cell: (info) => (
				<Badge variant={info.getValue() ? "success" : "outline"}>
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
	], [deleteMutation.mutate]);

	const table = useReactTable({
		data: data?.data ?? [],
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	return (
		<div className="p-8">
			<div className="mb-6 flex items-center justify-between">
				<h1 className="text-2xl font-bold">Snapins</h1>
				<div>
					<input
						ref={fileRef}
						type="file"
						className="hidden"
						onChange={handleUpload}
					/>
					<Button onClick={() => fileRef.current?.click()} disabled={uploading}>
						<Upload className="h-4 w-4" />{" "}
						{uploading ? "Uploading…" : "Upload Snapin"}
					</Button>
				</div>
			</div>

			<DataTable
				table={table}
				isLoading={isLoading}
				emptyMessage="No snapins uploaded"
			/>
		</div>
	);
}
