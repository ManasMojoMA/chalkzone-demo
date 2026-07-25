"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { SidebarProvider } from "@/components/ui/sidebar";
import AppSidebar from "@/components/layout/app-sidebar";
import AppHeader from "@/components/layout/app-header";
import { ChatWidget } from "@/components/chat/chat-widget";
import { OnboardingTour } from "@/components/onboarding-tour";
import { ThemeSync } from "@/components/theme-sync";
import { useAuth } from "@/lib/auth-context";
import { getMyPermissions } from "@/app/dashboard/admin/permissions/actions";
import { sectionForPath, type PermissionLevel } from "@/lib/permissions";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();

  // Configurable access control: a section set to "Hidden" for this role is
  // blocked even when visited by direct link, not just hidden from the menu.
  const [perms, setPerms] = useState<Record<string, PermissionLevel> | null>(null);
  useEffect(() => {
    if (user) getMyPermissions().then(setPerms).catch(() => setPerms(null));
  }, [user]);

  // Route protection is enforced server-side by the middleware; while the
  // client profile loads (e.g. right after login) show a lightweight gate
  // instead of redirecting — redirecting here raced the background load.
  if (isLoading || !isAuthenticated) {
    return <div className="flex h-screen w-full items-center justify-center">Loading...</div>;
  }

  const section = sectionForPath(pathname ?? "");
  const blocked = section && perms && perms[section] === "NONE";

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-slate-50/50 dark:bg-slate-950/50">
        <AppSidebar />
        <div className="flex-col flex flex-1 w-full min-w-0">
          <AppHeader />
          <main className="flex-1 overflow-auto p-4 md:p-6 md:pt-4">
            <div className="mx-auto w-full max-w-7xl">
              {blocked ? (
                <div className="py-24 text-center space-y-2">
                  <p className="text-lg font-bold">This section isn&apos;t available for your role</p>
                  <p className="text-sm text-muted-foreground">An administrator has disabled access. If you believe this is a mistake, contact the admin office.</p>
                </div>
              ) : (
                children
              )}
            </div>
          </main>
        </div>
      </div>
      <ChatWidget />
      <OnboardingTour />
      <ThemeSync />
    </SidebarProvider>
  );
}
