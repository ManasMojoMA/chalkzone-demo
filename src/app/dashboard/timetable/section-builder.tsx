"use client";

import { useCallback, useEffect, useState } from "react";
import {
  listPrograms,
  listSectionAssignments,
  listClassrooms,
  getSectionGrid,
  getPlacementOptions,
  placeSlot,
  removeSlot,
  type Weekday,
} from "./actions";
import { TimetableGrid, PERIOD_TIMES, type GridSlot } from "./timetable-grid";
import { CalendarSync } from "./calendar-sync";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

type Programs = Awaited<ReturnType<typeof listPrograms>>;
type Assignments = Awaited<ReturnType<typeof listSectionAssignments>>;
type Rooms = Awaited<ReturnType<typeof listClassrooms>>;

/** Grid builder for one section: pick it, click cells to place classes. */
export function SectionBuilder({ filterProgramId, filterBatchId }: { filterProgramId?: string; filterBatchId?: string }) {
  const [programs, setPrograms] = useState<Programs>([]);
  const [sectionId, setSectionId] = useState("");
  const [grid, setGrid] = useState<{ workingDays: string[]; slots: GridSlot[] } | null>(null);
  const [assignments, setAssignments] = useState<Assignments>([]);
  const [rooms, setRooms] = useState<Rooms>([]);
  const [loadingGrid, setLoadingGrid] = useState(false);

  // Placement dialog — options arrive pre-checked: anything unusable at this
  // day/period is shown greyed out with the reason (smart placement).
  const [placing, setPlacing] = useState<{ day: string; period: number } | null>(null);
  const [pickAssignment, setPickAssignment] = useState("");
  const [pickRoom, setPickRoom] = useState("");
  const [saving, setSaving] = useState(false);
  const [options, setOptions] = useState<Awaited<ReturnType<typeof getPlacementOptions>> | null>(null);

  useEffect(() => {
    if (!placing || !sectionId) { setOptions(null); return; }
    let cancelled = false;
    setOptions(null);
    getPlacementOptions(sectionId, placing.day as Weekday, placing.period)
      .then((o) => { if (!cancelled) setOptions(o); })
      .catch(() => { if (!cancelled) setOptions(null); });
    return () => { cancelled = true; };
  }, [placing, sectionId]);

  const loadPrograms = useCallback(async () => {
    setPrograms(await listPrograms());
    setRooms(await listClassrooms());
  }, []);

  useEffect(() => { loadPrograms(); }, [loadPrograms]);

  const loadGrid = useCallback(async () => {
    if (!sectionId) { setGrid(null); return; }
    setLoadingGrid(true);
    try {
      const [g, a] = await Promise.all([getSectionGrid(sectionId), listSectionAssignments(sectionId)]);
      setGrid(g ? { workingDays: g.workingDays, slots: g.slots as GridSlot[] } : null);
      setAssignments(a);
    } finally {
      setLoadingGrid(false);
    }
  }, [sectionId]);

  useEffect(() => { loadGrid(); }, [loadGrid]);

  const allSections = programs
    .filter((p) => !filterProgramId || p.id === filterProgramId)
    .flatMap((p) => p.sections.map((s) => ({ ...s, programName: p.name })))
    .filter((s) => !filterBatchId || s.batchId === filterBatchId);
  const selectedSection = allSections.find((s) => s.id === sectionId);

  const confirmPlacement = async () => {
    if (!placing || !pickAssignment || !pickRoom) return toast.error("Pick a course and a room");
    setSaving(true);
    try {
      const res = await placeSlot({
        sectionId,
        assignmentId: pickAssignment,
        classroomId: pickRoom,
        day: placing.day as Weekday,
        period: placing.period,
      });
      if (res.success) {
        toast.success("Class placed");
        setPlacing(null);
        setPickAssignment("");
        setPickRoom("");
        loadGrid();
      } else {
        // Conflict messages stay visible in the dialog via toast
        toast.error(res.error, { duration: 6000 });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (slotId: string) => {
    if (!confirm("Remove this class from the timetable?")) return;
    await removeSlot(slotId);
    toast.success("Removed");
    loadGrid();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={sectionId} onValueChange={(v) => setSectionId(v || "")}>
          <SelectTrigger className="h-10 w-[380px]">
            <SelectValue placeholder="Pick a section to build its timetable…" />
          </SelectTrigger>
          <SelectContent>
            {allSections.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.programName} · {s.batch.label} · Sem {s.semester} · Section {s.name} ({s.type})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedSection && (
          <Badge variant="outline" className="py-1">
            Attends {grid?.workingDays.join(" · ")}
          </Badge>
        )}
      </div>

      {!sectionId ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            Choose a section above — sections are created in step 2.
          </CardContent>
        </Card>
      ) : loadingGrid || !grid ? (
        <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Click an empty cell to place a class. Every placement is validated live: faculty double-booking (across all
            programmes), room double-booking, room day-availability, the section&apos;s day off, and faculty weekly-hour caps.
          </p>
          <TimetableGrid
            slots={grid.slots}
            workingDays={grid.workingDays}
            editable
            onCellClick={(day, period) => { setPlacing({ day, period }); setPickAssignment(""); setPickRoom(""); }}
            onRemoveSlot={handleRemove}
          />
          {/* Admins can hand out / preview the same calendar files students get */}
          <CalendarSync slots={grid.slots} sectionId={sectionId} />
        </>
      )}

      <Dialog open={!!placing} onOpenChange={(o) => !o && setPlacing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Place a class — {placing?.day} · Period {placing?.period}
            </DialogTitle>
            <DialogDescription>
              {placing ? PERIOD_TIMES[placing.period - 1] : ""} · {selectedSection?.programName} Sem {selectedSection?.semester} Section {selectedSection?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {options === null ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Checking what&apos;s available at this time…
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold text-muted-foreground">Course &amp; faculty <span className="font-normal">— greyed options can&apos;t be placed here (reason shown)</span></p>
                  <Select value={pickAssignment} onValueChange={(v) => setPickAssignment(v || "")}>
                    <SelectTrigger><SelectValue placeholder="Pick the course to teach" /></SelectTrigger>
                    <SelectContent>
                      {options.courseOptions.map((o) => (
                        <SelectItem key={o.id} value={o.id} disabled={o.disabled}>
                          {o.label}{o.reason ? ` — ✕ ${o.reason}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold text-muted-foreground">Classroom <span className="font-normal">— occupied/unavailable rooms are greyed with why</span></p>
                  <Select value={pickRoom} onValueChange={(v) => setPickRoom(v || "")}>
                    <SelectTrigger><SelectValue placeholder="Pick a free room" /></SelectTrigger>
                    <SelectContent>
                      {options.roomOptions.map((o) => (
                        <SelectItem key={o.id} value={o.id} disabled={o.disabled}>
                          {o.label}
                          {selectedSection && o.capacity < selectedSection.studentCount ? " · ⚠ smaller than section" : ""}
                          {o.reason ? ` — ✕ ${o.reason}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {options.courseOptions.length === 0 && (
                  <p className="text-xs text-destructive">This section has no course assignments yet — add them in step 2.</p>
                )}
                {options.courseOptions.length > 0 && options.courseOptions.every((o) => o.disabled) && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">Nothing can be placed in this slot — every course is blocked (see reasons above). Try another cell.</p>
                )}
              </>
            )}
            <Button className="w-full" onClick={confirmPlacement} disabled={saving || !pickAssignment || !pickRoom}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Place Class
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
