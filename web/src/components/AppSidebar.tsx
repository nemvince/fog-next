import {
	ChartBar,
	Cpu,
	FolderOpen,
	Gauge,
	Gear,
	HardDrive,
	HouseSimple,
	Package,
	SignOut,
	Sliders,
	Users,
	WifiMedium,
} from "@phosphor-icons/react";
import { Link, useRouter } from "@tanstack/react-router";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarSeparator,
} from "@/components/ui/sidebar";
import { useAuthStore } from "@/store/auth";

const navItems = [
	{ to: "/dashboard", label: "Dashboard", icon: HouseSimple },
	{ to: "/hosts", label: "Hosts", icon: Cpu },
	{ to: "/images", label: "Images", icon: HardDrive },
	{ to: "/tasks", label: "Tasks", icon: Gauge },
	{ to: "/groups", label: "Groups", icon: FolderOpen },
	{ to: "/snapins", label: "Snapins", icon: Package },
	{ to: "/storage", label: "Storage", icon: WifiMedium },
	{ to: "/pending-macs", label: "Pending MACs", icon: WifiMedium },
] as const;

const adminItems = [
	{ to: "/users", label: "Users", icon: Users },
	{ to: "/settings", label: "Settings", icon: Sliders },
] as const;

const reportItems = [
	{ to: "/reports", label: "Reports", icon: ChartBar },
] as const;

export function AppSidebar() {
	const router = useRouter();
	const logout = useAuthStore((s) => s.logout);

	const handleLogout = () => {
		logout();
		void router.navigate({ to: "/login" });
	};

	return (
		<Sidebar>
			<SidebarHeader>
				<div className="flex items-center gap-2 px-2 py-1">
					<Gear className="size-5 text-primary" />
					<span className="font-semibold">FOG Next</span>
				</div>
			</SidebarHeader>

			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupLabel>Navigation</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{navItems.map(({ to, label, icon: Icon }) => (
								<SidebarMenuItem key={to}>
									<SidebarMenuButton
										render={
											<Link
												to={to}
												activeProps={{
													className:
														"bg-sidebar-accent text-sidebar-accent-foreground",
												}}
											>
												<Icon />
												<span>{label}</span>
											</Link>
										}
									/>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>

				<SidebarSeparator />

				<SidebarGroup>
					<SidebarGroupLabel>Administration</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{adminItems.map(({ to, label, icon: Icon }) => (
								<SidebarMenuItem key={to}>
									<SidebarMenuButton
										render={
											<Link
												to={to}
												activeProps={{
													className:
														"bg-sidebar-accent text-sidebar-accent-foreground",
												}}
											>
												<Icon />
												<span>{label}</span>
											</Link>
										}
									/>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>

				<SidebarSeparator />

				<SidebarGroup>
					<SidebarGroupContent>
						<SidebarMenu>
							{reportItems.map(({ to, label, icon: Icon }) => (
								<SidebarMenuItem key={to}>
									<SidebarMenuButton
										render={
											<Link
												to={to}
												activeProps={{
													className:
														"bg-sidebar-accent text-sidebar-accent-foreground",
												}}
											>
												<Icon />
												<span>{label}</span>
											</Link>
										}
									/>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>

			<SidebarFooter>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton onClick={handleLogout}>
							<SignOut />
							<span>Sign out</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
		</Sidebar>
	);
}
