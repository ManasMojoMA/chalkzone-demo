"use client";

import { Kanban, List } from "lucide-react";
import { cn } from "@/lib/utils";

export type ViewMode = "list" | "kanban";

/**
 * Prominent List/Kanban switcher (neo-brutalist, top-right of module pages).
 * Persist the chosen mode yourself via the onChange handler.
 */
export function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  const options: { mode: ViewMode; label: string; hint: string; icon: React.ReactNode }[] = [
    { mode: "list", label: "List", hint: "Traditional list view", icon: <List className="h-4 w-4" aria-hidden /> },
    { mode: "kanban", label: "Kanban", hint: "Board view — one color-coded column per status", icon: <Kanban className="h-4 w-4" aria-hidden /> },
  ];
  return (
    <div className="inline-flex items-center rounded-lg border-2 border-slate-900 dark:border-border bg-white dark:bg-card shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] dark:shadow-[3px_3px_0px_0px_rgba(0,0,0,0.6)] overflow-hidden">
      {options.map((opt, i) => (
        <button
          key={opt.mode}
          type="button"
          onClick={() => onChange(opt.mode)}
          title={opt.hint}
          aria-pressed={view === opt.mode}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold transition-colors",
            i > 0 && "border-l-2 border-slate-900 dark:border-border",
            view === opt.mode ? "bg-primary text-white" : "hover:bg-muted text-foreground"
          )}
        >
          {opt.icon}
          {opt.label}
        </button>
      ))}
    </div>
  );
}
