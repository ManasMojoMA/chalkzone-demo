"use client";

import { cn } from "@/lib/utils";
import { X } from "lucide-react";

export const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;
export const PERIOD_TIMES = [
  "09:00–10:00", "10:00–11:00", "11:00–12:00", "12:00–13:00",
  "14:00–15:00", "15:00–16:00", "16:00–17:00", "17:00–18:00",
];

export type GridSlot = {
  id: string;
  day: string;
  period: number;
  assignment: {
    subject: { code: string; name: string };
    faculty: { user: { name: string | null } };
  };
  classroom: { name: string };
  section?: { name: string; program: { name: string } };
};

export function TimetableGrid({
  slots,
  workingDays,
  editable = false,
  showSection = false,
  onCellClick,
  onRemoveSlot,
}: {
  slots: GridSlot[];
  workingDays: string[];
  editable?: boolean;
  showSection?: boolean;
  onCellClick?: (day: string, period: number) => void;
  onRemoveSlot?: (slotId: string) => void;
}) {
  const byCell = new Map<string, GridSlot>();
  for (const s of slots) byCell.set(`${s.day}-${s.period}`, s);

  return (
    <div className="overflow-x-auto border-2 border-slate-900 dark:border-border rounded-lg shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] dark:shadow-[4px_4px_0px_0px_rgba(0,0,0,0.6)]">
      <table className="w-full border-collapse min-w-[820px] bg-white dark:bg-card">
        <thead>
          <tr>
            <th className="border-b-2 border-r-2 border-slate-900 dark:border-border bg-slate-900 text-white text-xs font-bold p-2 w-28">
              Period
            </th>
            {DAYS.map((d) => (
              <th
                key={d}
                className={cn(
                  "border-b-2 border-slate-900 dark:border-border text-xs font-bold p-2 uppercase tracking-wide",
                  workingDays.includes(d) ? "bg-primary/10 text-foreground" : "bg-slate-100 dark:bg-slate-900/50 text-muted-foreground"
                )}
              >
                {d}
                {!workingDays.includes(d) && <span className="block text-[9px] font-medium normal-case">day off</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERIOD_TIMES.map((time, idx) => {
            const period = idx + 1;
            return (
              <tr key={period}>
                <td className="border-r-2 border-b border-slate-900/20 dark:border-border/60 bg-muted/40 p-2 text-[10px] font-bold text-center">
                  <div>P{period}</div>
                  <div className="text-muted-foreground font-medium">{time}</div>
                </td>
                {DAYS.map((day) => {
                  const slot = byCell.get(`${day}-${period}`);
                  const offDay = !workingDays.includes(day);
                  return (
                    <td
                      key={day}
                      className={cn(
                        "border-b border-l border-slate-900/10 p-1 align-top h-16",
                        offDay && "bg-slate-50 dark:bg-slate-900/30",
                        editable && !offDay && !slot && "cursor-pointer hover:bg-primary/5 transition-colors"
                      )}
                      onClick={() => editable && !offDay && !slot && onCellClick?.(day, period)}
                      title={editable && !offDay && !slot ? "Click to place a class" : undefined}
                    >
                      {slot && (
                        <div className="relative rounded-md border-l-4 border-primary bg-primary/5 p-1.5 text-[10px] leading-tight group">
                          <div className="font-bold">{slot.assignment.subject.code}</div>
                          <div className="text-muted-foreground truncate">{slot.assignment.faculty.user.name}</div>
                          <div className="text-muted-foreground">{slot.classroom.name}</div>
                          {showSection && slot.section && (
                            <div className="text-[9px] font-medium">{slot.section.program.name} · {slot.section.name}</div>
                          )}
                          {editable && onRemoveSlot && (
                            <button
                              type="button"
                              title="Remove this class"
                              onClick={(e) => { e.stopPropagation(); onRemoveSlot(slot.id); }}
                              className="absolute top-0.5 right-0.5 h-4 w-4 rounded bg-destructive/90 text-white hidden group-hover:flex items-center justify-center"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
