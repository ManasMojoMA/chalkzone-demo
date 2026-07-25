"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { getMyTimetable } from "./actions";
import { TimetableGrid, type GridSlot } from "./timetable-grid";
import { CalendarSync } from "./calendar-sync";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, CalendarDays, Loader2 } from "lucide-react";

type MyTimetable = Awaited<ReturnType<typeof getMyTimetable>>;

// ─── Read-only view (students & faculty) ────────────────────────────────────

function MyTimetableView() {
  const [data, setData] = useState<MyTimetable | null>(null);
  useEffect(() => { getMyTimetable().then(setData); }, []);

  if (!data) return <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;

  if (data.kind === "none") {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground text-sm">{data.reason}</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Badge variant="outline" className="py-1">{data.label}</Badge>
      <TimetableGrid
        slots={data.slots as GridSlot[]}
        workingDays={data.workingDays}
        showSection={data.kind === "faculty"}
      />
      <CalendarSync
        slots={data.slots as GridSlot[]}
        sectionId={data.kind === "section" ? data.sectionId : undefined}
        studentProfileId={data.kind === "section" ? data.studentProfileId : undefined}
      />
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function TimetablePage() {
  const { user } = useAuth();
  if (!user) return null;

  const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-black tracking-tighter uppercase inline-flex items-center gap-2">
          <CalendarDays className="h-7 w-7 text-primary" /> Timetable
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {isAdmin
            ? "Timetables are built per batch inside Program Management."
            : "Your weekly schedule — sync it straight to your calendar below."}
        </p>
      </div>

      {isAdmin ? <AdminPointer /> : <MyTimetableView />}
    </div>
  );
}

/** Admins build timetables inside Program Management (programme → batch →
 *  Timetable tab) so everything about a batch lives in one place. */
function AdminPointer() {
  return (
    <Card>
      <CardContent className="py-14 text-center space-y-3">
        <CalendarDays className="h-10 w-10 mx-auto text-primary/60" />
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          The timetable builder now lives with each batch: open{" "}
          <b>Program Management</b>, pick the programme and batch, then use its <b>Timetable</b> tab —
          sections, courses, faculty and students are all right there.
        </p>
        <Link
          href="/dashboard/programs"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
        >
          Open Program Management <ArrowRight className="h-4 w-4" />
        </Link>
      </CardContent>
    </Card>
  );
}
