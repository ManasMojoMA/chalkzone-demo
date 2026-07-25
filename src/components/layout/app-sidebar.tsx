"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth, type UserRole } from "@/lib/auth-context";
import { getMyPermissions } from "@/app/dashboard/admin/permissions/actions";
import { sectionForPath, type PermissionLevel } from "@/lib/permissions";
import { AnimatedLogo } from "@/components/animated-logo";
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
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronsUpDown,
  LayoutDashboard,
  CalendarCheck,
  TrendingUp,
  FileText,
  Briefcase,
  Megaphone,
  Ticket,
  Users,
  BookOpen,
  ClipboardList,
  Calendar,
  Building2,
  Settings,
  Search,
  LineChart,
  LogOut,
  FileCheck2,
  Wrench,
  GraduationCap,
} from "lucide-react";
import { useRouter } from "next/navigation";

// Define menu items per role — every url must map to an existing page
const ROLE_MENUS: Record<UserRole, { title: string; url: string; icon: any }[]> = {
  STUDENT: [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "My Attendance", url: "/dashboard/attendance", icon: CalendarCheck },
    { title: "My Performance", url: "/dashboard/performance", icon: TrendingUp },
    { title: "My Resumes", url: "/dashboard/resumes", icon: FileText },
    { title: "Jobs & Internships", url: "/dashboard/placements", icon: Briefcase },
    { title: "Tickets", url: "/dashboard/tickets", icon: Ticket },
    { title: "Timetable", url: "/dashboard/timetable", icon: Calendar },
    { title: "Announcements", url: "/dashboard/announcements", icon: Megaphone },
  ],
  FACULTY: [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Mark Attendance", url: "/dashboard/attendance", icon: CalendarCheck },
    { title: "Student Performance", url: "/dashboard/performance", icon: TrendingUp },
    { title: "My Appraisals", url: "/dashboard/appraisals", icon: FileCheck2 },
    { title: "Tickets", url: "/dashboard/tickets", icon: Ticket },
    { title: "Knowledge Base", url: "/dashboard/knowledge-base", icon: BookOpen },
    { title: "Timetable", url: "/dashboard/timetable", icon: Calendar },
    { title: "Announcements", url: "/dashboard/announcements", icon: Megaphone },
  ],
  ADMIN: [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "User Management", url: "/dashboard/admin/users", icon: Users },
    { title: "Program Management", url: "/dashboard/programs", icon: GraduationCap },
    { title: "Configuration", url: "/dashboard/admin/config", icon: Wrench },
    { title: "Placements", url: "/dashboard/placements", icon: Briefcase },
    { title: "Appraisals", url: "/dashboard/appraisals", icon: FileCheck2 },
    { title: "Tickets", url: "/dashboard/tickets", icon: Ticket },
    { title: "Knowledge Base", url: "/dashboard/knowledge-base", icon: BookOpen },
    { title: "Announcements", url: "/dashboard/announcements", icon: Megaphone },
  ],
  SUPER_ADMIN: [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "User Management", url: "/dashboard/admin/users", icon: Users },
    { title: "Program Management", url: "/dashboard/programs", icon: GraduationCap },
    { title: "Configuration", url: "/dashboard/admin/config", icon: Wrench },
    { title: "System Settings", url: "/dashboard/admin/settings", icon: Settings },
    { title: "Placements", url: "/dashboard/placements", icon: Briefcase },
    { title: "Appraisals", url: "/dashboard/appraisals", icon: FileCheck2 },
    { title: "Tickets", url: "/dashboard/tickets", icon: Ticket },
    { title: "Knowledge Base", url: "/dashboard/knowledge-base", icon: BookOpen },
    { title: "Announcements", url: "/dashboard/announcements", icon: Megaphone },
  ],
  HR: [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Jobs & Applications", url: "/dashboard/placements", icon: Megaphone },
    { title: "Tickets", url: "/dashboard/tickets", icon: Ticket },
    { title: "Announcements", url: "/dashboard/announcements", icon: Megaphone },
  ],
  MANAGER: [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "User Management", url: "/dashboard/admin/users", icon: Users },
    { title: "Appraisals", url: "/dashboard/appraisals", icon: FileCheck2 },
    { title: "Tickets", url: "/dashboard/tickets", icon: Ticket },
    { title: "Announcements", url: "/dashboard/announcements", icon: Megaphone },
  ],
  PARENT: [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Announcements", url: "/dashboard/announcements", icon: Megaphone },
  ],
  EXECUTIVE: [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Announcements", url: "/dashboard/announcements", icon: Megaphone },
  ],
};

export default function AppSidebar() {
  const { user, logout } = useAuth();
  const router = useRouter();

  // Configurable access control: sections set to "Hidden" for this role
  // disappear from the menu (Configuration → Access Control).
  const [perms, setPerms] = useState<Record<string, PermissionLevel> | null>(null);
  useEffect(() => {
    if (user) getMyPermissions().then(setPerms).catch(() => setPerms(null));
  }, [user]);

  if (!user) return null;

  const menuItems = (ROLE_MENUS[user.role] || []).filter((item) => {
    if (!perms) return true;
    const section = sectionForPath(item.url);
    return !section || perms[section] !== "NONE";
  });

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <Sidebar variant="inset">
      <SidebarHeader className="p-4 border-b">
        <Link href="/dashboard">
          <AnimatedLogo size="sm" />
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title} data-tour={item.title}>
                  <SidebarMenuButton tooltip={item.title} render={<Link href={item.url} />}>
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Compact account row — profile/settings/logout live in its menu */}
      <SidebarFooter className="p-2 border-t border-border">
        <DropdownMenu>
          <DropdownMenuTrigger className="w-full rounded-lg p-2 flex items-center gap-2.5 hover:bg-muted/60 transition-colors text-left group" title="Account menu">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary font-medium text-xs">
                {(user.name || "User").split(" ").map((n) => n[0]).join("").substring(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col flex-1 overflow-hidden leading-tight">
              <span className="font-semibold text-sm truncate">{user.name || "User"}</span>
              <span className="text-[10px] font-semibold text-muted-foreground tracking-wide">{user.role.replace("_", " ")}</span>
            </div>
            <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground shrink-0" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-52">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground truncate">{user.email}</DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/dashboard/profile" />}>
              <Users className="h-4 w-4 mr-2" /> My Profile
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/dashboard/settings" />}>
              <Settings className="h-4 w-4 mr-2" /> Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} variant="destructive">
              <LogOut className="h-4 w-4 mr-2" /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
