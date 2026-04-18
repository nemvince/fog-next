import { cn } from "@/lib/utils";

export interface InputProps
	extends React.InputHTMLAttributes<HTMLInputElement> {
	label?: string;
	error?: string;
}

export function Input({ className, label, error, id, ...props }: InputProps) {
	return (
		<div className="flex flex-col gap-1">
			{label && (
				<label htmlFor={id} className="text-xs text-gray-400">
					{label}
				</label>
			)}
			<input
				id={id}
				className={cn(
					"rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100",
					"placeholder:text-gray-500",
					"outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500",
					"disabled:opacity-50",
					error && "border-red-500",
					className,
				)}
				{...props}
			/>
			{error && <p className="text-xs text-red-400">{error}</p>}
		</div>
	);
}
