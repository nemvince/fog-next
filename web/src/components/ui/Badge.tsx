import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
	"inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
	{
		variants: {
			variant: {
				default: "bg-blue-600/20 text-blue-300",
				success: "bg-green-600/20 text-green-300",
				warning: "bg-yellow-600/20 text-yellow-300",
				destructive: "bg-red-600/20 text-red-300",
				outline: "border border-gray-700 text-gray-400",
			},
		},
		defaultVariants: { variant: "default" },
	},
);

export interface BadgeProps
	extends React.HTMLAttributes<HTMLSpanElement>,
		VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
	return (
		<span className={cn(badgeVariants({ variant }), className)} {...props} />
	);
}
