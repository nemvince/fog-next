import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { queryClient } from "@/lib/queryClient";

const RootLayout = () => (
	<QueryClientProvider client={queryClient}>
		<ThemeProvider>
			<TooltipProvider>
				<Outlet />
				<Toaster />
			</TooltipProvider>
		</ThemeProvider>
		<ReactQueryDevtools initialIsOpen={false} />
	</QueryClientProvider>
);

export const Route = createRootRoute({ component: RootLayout });
