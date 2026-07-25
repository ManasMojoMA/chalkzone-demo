"use client";

import { useEffect, useState } from "react";
import {
  listPrograms, saveProgram, deleteProgram,
  listSubjects,
  listAssignmentOptions,
  listDesignationRules, saveDesignationRule, deleteDesignationRule,
  listClassrooms, saveClassroom, deleteClassroom,
  listBatches, saveBatch, deleteBatch,
} from "./actions";
import { DAYS } from "./timetable-grid";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export type Programs = Awaited<ReturnType<typeof listPrograms>>;
export type Options = Awaited<ReturnType<typeof listAssignmentOptions>>;
export type Rules = Awaited<ReturnType<typeof listDesignationRules>>;
export type Rooms = Awaited<ReturnType<typeof listClassrooms>>;
export type Subjects = Awaited<ReturnType<typeof listSubjects>>;

/** "MON" → "MON–FRI": the 5-day attendance window spelled out the same way
 *  everywhere (dropdowns, saved-section rows, badges). */
export function windowLabel(weekStart: string): string {
  const start = Math.max(0, DAYS.indexOf(weekStart as (typeof DAYS)[number]));
  return `${DAYS[start]}–${DAYS[(start + 4) % 7]}`;
}

// ─── Programs ───────────────────────────────────────────────────────────────

export function ProgramsPanel({ programs, onChanged }: { programs: Programs; onChanged: () => void }) {
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const add = async () => {
    // Student strength is a property of each batch, not the programme, so it's
    // no longer captured here — it's derived from batch rosters.
    const res = await saveProgram({ id: editingId ?? undefined, name, totalStudents: 0 });
    if (res.success) {
      toast.success(editingId ? "Programme updated" : "Programme saved");
      setName(""); setEditingId(null);
      onChanged();
    } else toast.error(res.error);
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Programmes</CardTitle>
        <CardDescription>e.g. B.Tech CSE, MBA, BBA. Student numbers are set per batch, not here.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground">Programme name</label>
            <Input placeholder="e.g. MBA Dual Specialisation" title="The degree programme's full name as students know it" value={name} onChange={(e) => setName(e.target.value)} className="h-9" onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
          </div>
          <div className="flex gap-1">
            <Button size="sm" className="h-9" onClick={add} title={editingId ? "Save changes" : "Add programme"}>
              {editingId ? "Save" : <Plus className="h-4 w-4" />}
            </Button>
            {editingId && (
              <Button size="sm" variant="outline" className="h-9" onClick={() => { setEditingId(null); setName(""); }}>Cancel</Button>
            )}
          </div>
        </div>
        <div className="space-y-1.5">
          {programs.map((p) => (
            <div key={p.id} className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${editingId === p.id ? "border-primary bg-primary/5" : ""}`}>
              <span className="font-medium">{p.name} <span className="text-muted-foreground text-xs">· {p.sections.length} sections</span></span>
              <span className="flex items-center gap-2 shrink-0 ml-2">
                <button type="button" title={`Edit ${p.name}`} className="text-muted-foreground hover:text-foreground" onClick={() => {
                  setEditingId(p.id); setName(p.name);
                }}><Pencil className="h-4 w-4" /></button>
                <button type="button" title={`Delete ${p.name}`} className="text-destructive" onClick={async () => {
                  if (!confirm(`Delete programme "${p.name}" and all its sections/timetables?`)) return;
                  const res = await deleteProgram(p.id);
                  if (res.success) { toast.success("Deleted"); onChanged(); }
                  else toast.error(res.error, { duration: 7000 });
                }}><Trash2 className="h-4 w-4" /></button>
              </span>
            </div>
          ))}
          {programs.length === 0 && <p className="text-xs text-muted-foreground">No programmes yet.</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Faculty designation rules ──────────────────────────────────────────────

export function RulesPanel({ rules, onChanged }: { rules: Rules | null; onChanged: () => void }) {
  const [designation, setDesignation] = useState("");
  const [hours, setHours] = useState("16");
  const [editingId, setEditingId] = useState<string | null>(null);

  const reset = () => { setEditingId(null); setDesignation(""); setHours("16"); };

  const save = async () => {
    const res = await saveDesignationRule(designation, Number(hours) || 16, editingId ?? undefined);
    if (res.success) { toast.success(editingId ? "Designation updated" : "Designation saved — its cap applies on the next placement"); reset(); onChanged(); }
    else toast.error(res.error);
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Faculty Designations &amp; Weekly-Hour Caps</CardTitle>
        <CardDescription>Create the designation tags you assign faculty at onboarding, each with a maximum teaching load per week. The cap is enforced when assigning courses and when placing classes. Faculty with no matching tag default to 16h.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-end">
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground">Designation name</label>
            <Input
              placeholder="e.g. Professor, Assistant Professor"
              title="The job title you'll pick when onboarding a faculty member — e.g. Professor, Associate Professor, Assistant Professor"
              value={designation} onChange={(e) => setDesignation(e.target.value)} list="known-designations" className="h-9"
            />
            <datalist id="known-designations">
              {rules?.knownDesignations.map((d) => <option key={d} value={d} />)}
            </datalist>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground">Max hours/week</label>
            <Input type="number" min={1} max={60} className="w-24 h-9" value={hours} onChange={(e) => setHours(e.target.value)}
              title="The most teaching hours per week a faculty member with this designation may be assigned across all sections" />
          </div>
          <div className="flex gap-1">
            <Button size="sm" className="h-9" onClick={save}>{editingId ? "Save" : <Plus className="h-4 w-4" />}</Button>
            {editingId && <Button size="sm" variant="outline" className="h-9" onClick={reset}>Cancel</Button>}
          </div>
        </div>
        <div className="space-y-1.5">
          {rules?.rules.map((r) => (
            <div key={r.id} className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${editingId === r.id ? "border-primary bg-primary/5" : ""}`}>
              <span>{r.designation} <Badge variant="secondary" className="ml-2 text-[10px]">{r.maxWeeklyHours}h/week</Badge></span>
              <span className="flex items-center gap-2 shrink-0 ml-2">
                <button type="button" title={`Edit ${r.designation}`} className="text-muted-foreground hover:text-foreground" onClick={() => {
                  setEditingId(r.id); setDesignation(r.designation); setHours(String(r.maxWeeklyHours));
                }}><Pencil className="h-4 w-4" /></button>
                <button type="button" title={`Delete rule for ${r.designation}`} className="text-destructive" onClick={async () => {
                  if (!confirm(`Delete designation "${r.designation}"? Faculty tagged with it will fall back to the 16h default.`)) return;
                  await deleteDesignationRule(r.id); toast.success("Deleted"); if (editingId === r.id) reset(); onChanged();
                }}><Trash2 className="h-4 w-4" /></button>
              </span>
            </div>
          ))}
          {(rules?.rules.length ?? 0) === 0 && <p className="text-xs text-muted-foreground">No designations yet — all faculty default to 16h/week.</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Classrooms ─────────────────────────────────────────────────────────────

export function RoomsPanel({ rooms, onChanged }: { rooms: Rooms; onChanged: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("Lecture Hall");
  const [capacity, setCapacity] = useState("60");
  const [days, setDays] = useState<string[]>([...DAYS]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const toggleDay = (d: string, on: boolean) =>
    setDays((prev) => (on ? [...new Set([...prev, d])] : prev.filter((x) => x !== d)));

  const reset = () => {
    setEditingId(null); setName(""); setType("Lecture Hall"); setCapacity("60"); setDays([...DAYS]);
  };

  const save = async () => {
    const res = await saveClassroom({ id: editingId ?? undefined, name, type, capacity: Number(capacity) || 60, availableDays: days });
    if (res.success) { toast.success(editingId ? "Classroom updated" : "Classroom saved"); reset(); onChanged(); }
    else toast.error(res.error);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Classrooms</CardTitle>
        <CardDescription>Every teaching room, its type, seating capacity and the weekdays it&apos;s open. These feed the timetable placement dialog, where the system blocks booking the same room twice at the same time.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground">Room name / number</label>
            <Input placeholder="e.g. LH-101" title="A unique name or number for the room, e.g. LH-101, Lab-3, Seminar Hall A" value={name} onChange={(e) => setName(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground">Room type</label>
            <Select value={type} onValueChange={(v) => setType(v || "Lecture Hall")}>
              <SelectTrigger className="h-9 text-xs" title="What kind of room this is — used for context when picking a room for a class"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Lecture Hall">Lecture Hall</SelectItem>
                <SelectItem value="Lab">Lab</SelectItem>
                <SelectItem value="Seminar Room">Seminar Room</SelectItem>
                <SelectItem value="Auditorium">Auditorium</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground">Capacity (seats)</label>
            <Input type="number" placeholder="60" value={capacity} onChange={(e) => setCapacity(e.target.value)} className="h-9" title="How many students the room seats — flagged if smaller than a section's strength" />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-muted-foreground">Available weekdays <span className="font-normal">— tick a day to make the room bookable on it</span></label>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((d) => (
              <label key={d} className="flex items-center gap-1 text-[11px] border rounded-md px-1.5 py-1 cursor-pointer hover:bg-muted/40" title={`Room is available for classes on ${d} when ticked`}>
                <Checkbox checked={days.includes(d)} onCheckedChange={(c) => toggleDay(d, !!c)} />
                {d}
              </label>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={save} className="flex-1"><Plus className="h-4 w-4 mr-1" /> {editingId ? "Update Classroom" : "Add Classroom"}</Button>
          {editingId && <Button size="sm" variant="outline" onClick={reset}>Cancel</Button>}
        </div>

        <div className="space-y-1.5 max-h-44 overflow-y-auto">
          {rooms.map((r) => (
            <div key={r.id} className={`flex items-center justify-between rounded-md border px-3 py-2 text-xs ${editingId === r.id ? "border-primary bg-primary/5" : ""}`}>
              <span>
                <span className="font-semibold">{r.name}</span>{" "}
                <span className="text-muted-foreground">· {r.type} · {r.capacity} seats · {r.availableDays}</span>
              </span>
              <span className="flex items-center gap-2 shrink-0 ml-2">
                <button type="button" title={`Edit ${r.name}`} className="text-muted-foreground hover:text-foreground" onClick={() => {
                  setEditingId(r.id); setName(r.name); setType(r.type); setCapacity(String(r.capacity));
                  setDays(r.availableDays ? r.availableDays.split(",") : [...DAYS]);
                }}><Pencil className="h-4 w-4" /></button>
                <button type="button" title={`Delete ${r.name}`} className="text-destructive" onClick={async () => {
                  if (!confirm(`Delete room ${r.name}?`)) return;
                  await deleteClassroom(r.id); toast.success("Deleted"); if (editingId === r.id) reset(); onChanged();
                }}><Trash2 className="h-4 w-4" /></button>
              </span>
            </div>
          ))}
          {rooms.length === 0 && <p className="text-xs text-muted-foreground">No classrooms yet — add the first one above.</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Batches (Configuration → Batches) ──────────────────────────────────────

export function BatchesPanel({ programs, onChanged }: { programs: Programs; onChanged?: () => void }) {
  const [batches, setBatches] = useState<Awaited<ReturnType<typeof listBatches>>>([]);
  const [programId, setProgramId] = useState("");
  const [label, setLabel] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = () => listBatches().then(setBatches).catch(() => {});
  useEffect(() => { load(); }, []);

  const reset = () => { setEditingId(null); setLabel(""); setProgramId(""); };

  const save = async () => {
    if (!programId) return toast.error("Pick the programme this batch belongs to");
    const res = await saveBatch({ programId, label, id: editingId ?? undefined });
    if (res.success) {
      toast.success(editingId ? "Batch updated" : "Batch created");
      reset(); load(); onChanged?.();
    } else toast.error(res.error);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Batches</CardTitle>
        <CardDescription>
          Each batch belongs to one programme and holds that cohort&apos;s students — e.g. MBA Dual
          Specialisation and MBA Digital Marketing can each have their own &quot;2026-2028&quot; batch.
          Students are added to a batch in <b>Program Management</b>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground">Programme</label>
            <Select value={programId} onValueChange={(v) => setProgramId(v || "")}>
              <SelectTrigger className="h-9 text-xs" title="The programme this batch belongs to"><SelectValue placeholder="Pick programme" /></SelectTrigger>
              <SelectContent>{programs.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground">Batch years (start-end)</label>
            <Input
              placeholder="e.g. 2026-2028"
              title="The admission-to-graduation years for this cohort, written as startyear-endyear"
              value={label} onChange={(e) => setLabel(e.target.value)} className="h-9"
              onKeyDown={(e) => { if (e.key === "Enter") save(); }}
            />
          </div>
          <div className="flex gap-1">
            <Button size="sm" className="h-9" onClick={save}>{editingId ? "Save" : <Plus className="h-4 w-4" />}</Button>
            {editingId && <Button size="sm" variant="outline" className="h-9" onClick={reset}>Cancel</Button>}
          </div>
        </div>
        <div className="space-y-1.5">
          {batches.map((b) => (
            <div key={b.id} className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${editingId === b.id ? "border-primary bg-primary/5" : ""}`}>
              <span className="font-medium">
                {b.program.name} · {b.label}{" "}
                <span className="text-muted-foreground text-xs">· {b._count.students} students · {b._count.sections} sections</span>
              </span>
              <span className="flex items-center gap-2 shrink-0 ml-2">
                <button type="button" title={`Edit batch ${b.label}`} className="text-muted-foreground hover:text-foreground" onClick={() => { setEditingId(b.id); setLabel(b.label); setProgramId(b.programId); }}>
                  <Pencil className="h-4 w-4" />
                </button>
                <button type="button" title={`Delete batch ${b.label}`} className="text-destructive" onClick={async () => {
                  if (!confirm(`Delete batch ${b.program.name} ${b.label}?`)) return;
                  const res = await deleteBatch(b.id);
                  if (res.success) { toast.success("Deleted"); load(); onChanged?.(); }
                  else toast.error(res.error, { duration: 6000 });
                }}><Trash2 className="h-4 w-4" /></button>
              </span>
            </div>
          ))}
          {batches.length === 0 && <p className="text-xs text-muted-foreground">No batches yet — add the first one above.</p>}
        </div>
      </CardContent>
    </Card>
  );
}
