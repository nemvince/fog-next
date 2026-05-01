import { Check } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import type { GlobalSetting } from "@/types";

export const Route = createFileRoute("/_auth/settings")({
	component: SettingsPage,
});

function SettingRow({ setting }: { setting: GlobalSetting }) {
	const qc = useQueryClient();
	const [value, setValue] = useState(setting.value);

	const mutation = useMutation({
		mutationFn: () =>
			api.put<GlobalSetting>(`/settings/${setting.key}`, { value }),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: ["settings"] });
			toast.success(`Saved "${setting.key}"`);
		},
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : "Save failed"),
	});

	const dirty = value !== setting.value;

	return (
		<div className="flex items-end gap-2">
			<div className="flex-1">
				<label
					className="text-sm font-medium"
					htmlFor={`setting-${setting.key}`}
				>
					{setting.description || setting.key}
				</label>
				<Input
					id={`setting-${setting.key}`}
					value={value}
					onChange={(e) => setValue(e.target.value)}
					className="mt-1"
				/>
			</div>
			{dirty && (
				<Button
					size="sm"
					disabled={mutation.isPending}
					onClick={() => mutation.mutate()}
				>
					{mutation.isPending ? "…" : <Check />}
				</Button>
			)}
		</div>
	);
}

function SettingsPage() {
	const { data, isLoading } = useQuery({
		queryKey: ["settings"],
		queryFn: () => api.get<GlobalSetting[]>("/settings"),
	});

	if (isLoading) {
		return <div className="text-muted-foreground">Loading settings…</div>;
	}

	const settings = data ?? [];

	// Group by category
	const grouped = settings.reduce<Record<string, GlobalSetting[]>>((acc, s) => {
		const cat = s.category || "General";
		if (!acc[cat]) acc[cat] = [];
		acc[cat].push(s);
		return acc;
	}, {});

	return (
		<div className="flex flex-col gap-6">
			<div>
				<h1 className="text-2xl font-bold">Settings</h1>
				<p className="text-muted-foreground">Global configuration</p>
			</div>

			{Object.entries(grouped).map(([category, items]) => (
				<Card key={category}>
					<CardHeader>
						<CardTitle>{category}</CardTitle>
					</CardHeader>
					<CardContent className="flex flex-col gap-4">
						{items.map((s) => (
							<SettingRow key={s.key} setting={s} />
						))}
					</CardContent>
				</Card>
			))}
		</div>
	);
}
