"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getMyTimetable } from "@/app/dashboard/timetable/actions";
import { PERIOD_TIMES, DAYS } from "@/app/dashboard/timetable/timetable-grid";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CalendarDays, ArrowRight } from "lucide-react";

type MyTimetable = Awaited<ReturnType<typeof getMyTimetable>>;

const TODAY = DAYS[(new Date().getDay() + 6) % 7]; // JS Sunday=0 → our MON-first list

/**
 * Compact this-week schedule for the dashboard: one column per attendance day,
 * today highlighted; the whole card links into the full timetable section.
 */
export function WeekScheduleCard() {
  const [data, setData] = useState<MyTimetable | null>(null);
  useEffect(() => { getMyTimetable().then(setData).catch(() => setData(null)); }, []);

  // Nothing to show (admins, unlinked profiles, still loading)
  if (!data || data.kind === "none") return null;

  const byDay = new Map<string, typeof data.slots>();
  for (const s of data.slots) {
    byDay.set(s.day, [...(byDay.get(s.day) ?? []), s].sort((a, b) => a.period - b.period));
  }

  return (
    <Link href="/dashboard/timetable" className="block group">
      <Card className="border-2 border-slate-900 dark:border-border shadow-[5px_5px_0px_0px_rgba(15,23,42,1)] dark:shadow-[5px_5px_0px_0px_rgba(0,0,0,0.6)] rounded-xl transition-all group-hover:translate-x-[2px] group-hover:translate-y-[2px] group-hover:shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base inline-flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" /> This week&apos;s classes
            <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground group-hover:text-primary transition-colors" />
          </CardTitle>
          <CardDescription className="text-xs">{data.label} · click for the full timetable & calendar sync</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${data.workingDays.length}, minmax(0, 1fr))` }}>
            {data.workingDays.map((day) => {
              const slots = byDay.get(day) ?? [];
              const isToday = day === TODAY;
              return (
                <div
                  key={day}
                  className={cn(
                    "rounded-lg border p-1.5 min-h-20",
                    isToday ? "border-primary bg-primary/5 ring-1 ring-primary/40" : "border-border/60"
                  )}
                >
                  <p className={cn("text-[10px] font-black uppercase tracking-wide mb-1", isToday ? "text-primary" : "text-muted-foreground")}>
                    {day}{isToday && <span className="ml-1 font-semibold normal-case">· today</span>}
                  </p>
                  <div className="space-y-1">
                    {slots.length === 0 && <p className="text-[10px] text-muted-foreground/60">—</p>}
                    {slots.map((s) => (
                      <div key={s.id} className="rounded border-l-2 border-primary bg-primary/5 px-1 py-0.5 text-[10px] leading-tight">
                        <span className="font-bold">{s.assignment.subject.code}</span>
                        <span className="text-muted-foreground block truncate">
                          {(PERIOD_TIMES[s.period - 1] ?? "").split(/[–-]/)[0]} · {s.classroom.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
