"use client";

import { useMemo, useState } from "react";
import { downloadIcs, googleCalendarLink, type CalendarClass } from "@/lib/ics";
import { PERIOD_TIMES, type GridSlot } from "./timetable-grid";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarPlus, Check, Copy, Download, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * "Sync to calendar" panel, written for people who find tech stressful:
 * one big obvious button first (Google opens and asks a single yes/no
 * question), then a numbered fallback that never assumes prior knowledge.
 * When studentProfileId is given, the feed is the student's PERSONAL merged
 * timetable (home section + elective enrollments); otherwise the section's.
 */
export function CalendarSync({
  slots,
  sectionId,
  studentProfileId,
}: {
  slots: GridSlot[];
  sectionId?: string;
  studentProfileId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const feedUrl =
    typeof window !== "undefined"
      ? studentProfileId
        ? `${window.location.origin}/api/calendar/student/${studentProfileId}`
        : sectionId
          ? `${window.location.origin}/api/calendar/${sectionId}`
          : null
      : null;

  const copyFeed = async () => {
    if (!feedUrl) return;
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopied(true);
      toast.success("Link copied! Now do step 2.");
      setTimeout(() => setCopied(false), 6000);
    } catch {
      toast.error("Couldn't copy automatically — long-press or right-click the button and choose Copy link address.");
    }
  };

  const classes: CalendarClass[] = useMemo(
    () =>
      slots.map((s) => ({
        id: s.id,
        day: s.day,
        period: s.period,
        title: `${s.assignment.subject.code} — ${s.assignment.subject.name}`,
        location: s.classroom.name,
        description: `Faculty: ${s.assignment.faculty.user.name ?? "TBA"} · ChalkZone timetable`,
      })),
    [slots]
  );

  if (classes.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base inline-flex items-center gap-2">
          <CalendarPlus className="h-4 w-4 text-primary" /> Get your classes in your phone&apos;s calendar
        </CardTitle>
        <CardDescription className="text-xs">
          Set it up once — about 30 seconds. After that, every timetable change updates in your calendar by itself.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* THE easy path */}
        {feedUrl && (
          <div className="rounded-xl border-2 border-primary/40 bg-primary/5 p-4 space-y-2">
            <p className="text-sm font-bold">The easy way (recommended)</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Click the red button. Google Calendar will open and ask{" "}
              <b>&quot;Add this calendar?&quot;</b> — click <b>Add</b> there, and you&apos;re done.
              All your classes appear, repeating every week.
            </p>
            <a
              href={`https://calendar.google.com/calendar/render?cid=${encodeURIComponent(feedUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-white hover:bg-primary/90 transition-colors border-2 border-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]"
            >
              <ExternalLink className="h-4 w-4" /> Add my classes to Google Calendar
            </a>
            <p className="text-[11px] text-muted-foreground">
              Nothing to install, no permissions to grant — Google only <i>reads</i> the public class schedule.
            </p>
          </div>
        )}

        {/* Step-by-step fallback */}
        {feedUrl && (
          <div className="rounded-xl border p-4 space-y-3">
            <p className="text-sm font-bold">If the button didn&apos;t work — 3 small steps</p>
            <ol className="space-y-3">
              <li className="flex gap-3 items-start">
                <span className="h-6 w-6 shrink-0 rounded-full bg-slate-900 text-white text-xs font-black flex items-center justify-center dark:bg-slate-100 dark:text-slate-900">1</span>
                <div className="space-y-1.5 min-w-0">
                  <p className="text-xs font-semibold">Copy your personal calendar link</p>
                  <Button size="sm" variant={copied ? "outline" : "default"} onClick={copyFeed} className={cn(copied && "border-green-600 text-green-700 dark:text-green-400")}>
                    {copied ? <><Check className="h-4 w-4 mr-1.5" /> Copied!</> : <><Copy className="h-4 w-4 mr-1.5" /> Copy my calendar link</>}
                  </Button>
                </div>
              </li>
              <li className="flex gap-3 items-start">
                <span className="h-6 w-6 shrink-0 rounded-full bg-slate-900 text-white text-xs font-black flex items-center justify-center dark:bg-slate-100 dark:text-slate-900">2</span>
                <div className="space-y-1.5 min-w-0">
                  <p className="text-xs font-semibold">Open Google Calendar&apos;s &quot;From URL&quot; page</p>
                  <a
                    href="https://calendar.google.com/calendar/u/0/r/settings/addbyurl"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-input bg-background px-3 text-xs font-medium hover:bg-muted transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Open the Google Calendar page
                  </a>
                </div>
              </li>
              <li className="flex gap-3 items-start">
                <span className="h-6 w-6 shrink-0 rounded-full bg-slate-900 text-white text-xs font-black flex items-center justify-center dark:bg-slate-100 dark:text-slate-900">3</span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold">Paste the link in the box and click &quot;Add calendar&quot;</p>
                  <p className="text-[11px] text-muted-foreground">Press Ctrl+V (or long-press → Paste on a phone). Your classes appear within a few seconds.</p>
                </div>
              </li>
            </ol>
            <p className="text-[11px] text-muted-foreground border-t pt-2">
              Using <b>Outlook</b> or <b>Apple Calendar</b>? Do step 1, then look for &quot;Subscribe to calendar&quot; / &quot;Add calendar from Internet&quot; in that app and paste the same link.
            </p>
          </div>
        )}

        {/* One-time download + per-class links, tucked away */}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              downloadIcs(classes, PERIOD_TIMES);
              toast.success("File downloaded — double-click it to import into any calendar app (one-time snapshot, won't auto-update)");
            }}
          >
            <Download className="h-4 w-4 mr-1.5" /> Download one-time file (.ics)
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setOpen((o) => !o)}>
            {open ? <ChevronUp className="h-4 w-4 mr-1.5" /> : <ChevronDown className="h-4 w-4 mr-1.5" />}
            Add classes one by one
          </Button>
        </div>
        {open && (
          <div className="grid gap-1.5 sm:grid-cols-2">
            {classes
              .slice()
              .sort((a, b) => a.day.localeCompare(b.day) || a.period - b.period)
              .map((c) => (
                <a
                  key={c.id}
                  href={googleCalendarLink(c, PERIOD_TIMES)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-md border px-2.5 py-1.5 text-xs hover:bg-primary/5 transition-colors"
                >
                  <span className="truncate">
                    <span className="font-semibold">{c.title.split(" — ")[0]}</span>{" "}
                    <span className="text-muted-foreground">· {c.day} {(PERIOD_TIMES[c.period - 1] ?? "").split(/[–-]/)[0]} · {c.location}</span>
                  </span>
                  <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground ml-2" />
                </a>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
