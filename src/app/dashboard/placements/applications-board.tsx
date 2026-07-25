"use client";

import { useMemo, useState } from "react";
import type { ApplicationStatus } from "@prisma/client";
import type { JobApplicationWithRelations } from "@/lib/types";
import { APP_STATUS_META, APP_STATUS_ORDER } from "@/lib/application-meta";
import { updateApplicationStatus } from "./actions";
import { ViewToggle, type ViewMode } from "@/components/view-toggle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  TouchSensor,
  DragStartEvent,
  DragEndEvent,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const VIEW_KEY = "cz-applications-view";
const ALL = "all";

type App = JobApplicationWithRelations & { jobPosting: { company?: { name: string } | null } };

function AppCardBody({ app }: { app: App }) {
  return (
    <>
      <CardHeader className="p-2.5 pb-1">
        <CardTitle className="text-xs font-semibold leading-tight line-clamp-1">
          {app.student?.user?.name || app.student?.rollNo || "Student"}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2.5 pt-0 text-[10px] text-muted-foreground space-y-1">
        <p className="font-medium text-foreground line-clamp-1">{app.jobPosting?.title}</p>
        <div className="flex items-center justify-between">
          <span className="line-clamp-1">{app.jobPosting?.company?.name}</span>
          <span>{new Date(app.appliedAt).toLocaleDateString()}</span>
        </div>
      </CardContent>
    </>
  );
}

function AppKanbanCard({ app, onMoved }: { app: App; onMoved: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: app.id,
    data: { app },
  });
  const meta = APP_STATUS_META[app.status];
  return (
    <Card
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.5 : 1 }}
      className={cn("border-l-4 bg-card shadow-sm cursor-grab active:cursor-grabbing touch-manipulation", meta.border)}
    >
      <AppCardBody app={app} />
    </Card>
  );
}

function AppColumn({ status, apps }: { status: ApplicationStatus; apps: App[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const meta = APP_STATUS_META[status];
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex-shrink-0 w-64 border-2 rounded-lg p-3 flex flex-col transition-colors",
        meta.column,
        isOver && "ring-2 ring-primary/60"
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-[11px] uppercase tracking-wide inline-flex items-center gap-1.5">
          <span className={cn("inline-block h-2 w-2 rounded-full", meta.dot)} />
          {meta.label}
        </h3>
        <Badge variant="secondary" className="px-1.5 text-[10px]">{apps.length}</Badge>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto min-h-[100px] max-h-[400px] pr-0.5">
        {apps.map((a) => (
          <AppKanbanCard key={a.id} app={a} onMoved={() => {}} />
        ))}
        {apps.length === 0 && (
          <div className="h-20 border-2 border-dashed border-black/10 dark:border-white/10 rounded-md flex items-center justify-center text-muted-foreground text-[10px] pointer-events-none">
            Drop here
          </div>
        )}
      </div>
    </div>
  );
}

export function ApplicationsBoard({
  applications,
  onChanged,
}: {
  applications: App[];
  onChanged: () => void;
}) {
  const [view, setView] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "kanban";
    const stored = localStorage.getItem(VIEW_KEY);
    return stored === "list" || stored === "kanban" ? stored : "kanban";
  });
  const [postingFilter, setPostingFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [active, setActive] = useState<App | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  const postings = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of applications) map.set(a.jobPostingId, a.jobPosting?.title ?? "Unknown");
    return [...map.entries()];
  }, [applications]);

  const filtered = applications.filter(
    (a) =>
      (postingFilter === ALL || a.jobPostingId === postingFilter) &&
      (statusFilter === ALL || a.status === statusFilter)
  );

  const changeView = (v: ViewMode) => {
    setView(v);
    localStorage.setItem(VIEW_KEY, v);
  };

  const moveTo = async (applicationId: string, status: ApplicationStatus) => {
    const res = await updateApplicationStatus(applicationId, status);
    if (res.success) {
      toast.success(`Moved to ${APP_STATUS_META[status].label}`);
      onChanged();
    } else {
      toast.error(res.error);
    }
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActive(null);
    const { active: a, over } = e;
    if (!over) return;
    const app = applications.find((x) => x.id === a.id);
    const newStatus = over.id as ApplicationStatus;
    if (!app || app.status === newStatus) return;
    moveTo(app.id, newStatus);
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={postingFilter} onValueChange={(v) => setPostingFilter(v || ALL)}>
            <SelectTrigger className="h-9 w-[220px] text-xs">
              <SelectValue placeholder="All postings" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All postings</SelectItem>
              {postings.map(([id, title]) => (
                <SelectItem key={id} value={id}>{title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v || ALL)}>
            <SelectTrigger className="h-9 w-[190px] text-xs">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              {APP_STATUS_ORDER.map((s) => (
                <SelectItem key={s} value={s}>{APP_STATUS_META[s].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <ViewToggle view={view} onChange={changeView} />
      </div>

      {view === "list" ? (
        <div className="border rounded-md overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Job</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Applied</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[210px]">Move to</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No applications match these filters.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((app) => {
                const meta = APP_STATUS_META[app.status];
                return (
                  <TableRow key={app.id}>
                    <TableCell className="font-medium">{app.student?.user?.name || app.student?.rollNo}</TableCell>
                    <TableCell>{app.jobPosting?.title}</TableCell>
                    <TableCell>{app.jobPosting?.company?.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(app.appliedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("border", meta.badge)}>
                        <span className={cn("mr-1.5 inline-block h-2 w-2 rounded-full", meta.dot)} />
                        {meta.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Select value={app.status} onValueChange={(v) => v && v !== app.status && moveTo(app.id, v as ApplicationStatus)}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {APP_STATUS_ORDER.map((s) => (
                            <SelectItem key={s} value={s}>{APP_STATUS_META[s].label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={(e: DragStartEvent) => setActive(e.active.data.current?.app ?? null)}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-3 overflow-x-auto pb-4">
            {APP_STATUS_ORDER.map((status) => (
              <AppColumn key={status} status={status} apps={filtered.filter((a) => a.status === status)} />
            ))}
          </div>
          <DragOverlay>
            {active ? (
              <Card className={cn("border-l-4 bg-card shadow-lg w-64", APP_STATUS_META[active.status].border)}>
                <AppCardBody app={active} />
              </Card>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
