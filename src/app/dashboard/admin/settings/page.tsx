"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { TicketSettingsDialog } from "@/app/dashboard/tickets/ticket-settings-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings2, ShieldCheck, Timer, Wrench, ArrowRight } from "lucide-react";

/** SUPER_ADMIN-only master controls: ticket SLA policy, escalation targets
 *  and category ownership. Operational catalogues (courses, designations &
 *  hour caps, classrooms) live in Configuration, which regular admins can
 *  also manage. */
export default function SystemSettingsPage() {
  const { user } = useAuth();
  const [slaOpen, setSlaOpen] = useState(false);

  if (!user) return null;
  if (user.role !== "SUPER_ADMIN") {
    return <div className="p-8 text-center text-muted-foreground">Access denied. Master-admin privileges required.</div>;
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <div className="border-b pb-4">
        <h1 className="text-2xl md:text-3xl font-black tracking-tighter uppercase inline-flex items-center gap-2">
          <ShieldCheck className="h-7 w-7 text-primary" /> System Settings
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Master-admin policy controls. Changes take effect immediately.
        </p>
      </div>

      {/* Ticket SLAs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base inline-flex items-center gap-2">
            <Timer className="h-4 w-4 text-primary" /> Ticket SLAs, escalation & category ownership
          </CardTitle>
          <CardDescription>
            Per ticket category: hours until an unresolved ticket escalates, who it escalates to (a role or a
            specific person), and which staff own the category (they surface first when reassigning, and unassigned
            tickets appear in their queue).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => setSlaOpen(true)}>
            <Settings2 className="h-4 w-4 mr-1.5" /> Open SLA & Escalation Settings
          </Button>
        </CardContent>
      </Card>

      {/* Operational catalogues moved to Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base inline-flex items-center gap-2">
            <Wrench className="h-4 w-4 text-primary" /> Courses, faculty designations & classrooms
          </CardTitle>
          <CardDescription>
            The operational catalogues — course list per programme, designation tags with weekly-hour caps,
            and the classroom inventory — live in Configuration so regular admins can manage them too.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/dashboard/admin/config">
            <Button variant="outline">
              Open Configuration <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          </Link>
        </CardContent>
      </Card>

      <TicketSettingsDialog open={slaOpen} onOpenChange={setSlaOpen} />
    </div>
  );
}
