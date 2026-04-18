import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
	"inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50",
	{
		variants: {
			variant: {
				default: "bg-blue-600 text-white hover:bg-blue-700",
				destructive: "bg-red-600 text-white hover:bg-red-700",
				outline:
					"border border-gray-700 bg-transparent text-gray-200 hover:bg-gray-800",
				ghost: "text-gray-400 hover:bg-gray-800 hover:text-gray-100",
				link: "text-blue-400 underline-offset-4 hover:underline",
			},
			size: {
				default: "h-9 px-4 py-2",
				sm: "h-7 px-3 text-xs",
				lg: "h-11 px-6",
				icon: "h-9 w-9",
			},
		},
		defaultVariants: { variant: "default", size: "default" },
	},
);

export interface ButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement>,
		VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
	return (
		<button
			className={cn(buttonVariants({ variant, size }), className)}
			{...props}
		/>
	);
}
