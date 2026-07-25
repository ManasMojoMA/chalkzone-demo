"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  getBatchDetail, listUnbatchedStudents, addStudentsToBatch, removeStudentFromBatch,
  getSectionEnrollment, enrollStudentInSection, enrollStudentsInSection,
  enrollStudentsCsvIntoSection, removeStudentFromSection,
  getStudentSectionPlacement,
  saveBatchSection, deleteBatchSection, saveSectionCourseFaculty, removeSectionCourse,
  listFacultyOptions, listProgramCourses, getBatchAnalytics,
} from "../../actions";
import { listSectionLabels } from "@/app/dashboard/admin/config/actions";
import { listSectionAssignments } from "@/app/dashboard/timetable/actions";
import { SectionBuilder } from "@/app/dashboard/timetable/section-builder";
import { windowLabel } from "@/app/dashboard/timetable/timetable-setup";
import { DAYS } from "@/app/dashboard/timetable/timetable-grid";
import { parseCsv, toCsv, downloadCsv } from "@/lib/csv";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Loader2, ChevronLeft, Users, Upload, Download, UserPlus, Trash2, Search,
  FileSpreadsheet, CheckCircle2, XCircle, GraduationCap, CalendarDays, BarChart3, Plus, Pencil, BookOpen,
} from "lucide-react";
import { toast } from "sonner";

type Batch = NonNullable<Awaited<ReturnType<typeof getBatchDetail>>>;
type Enrollment = NonNullable<Awaited<ReturnType<typeof getSectionEnrollment>>>;
type FacultyOpts = Awaited<ReturnType<typeof listFacultyOptions>>;
type ProgramCourses = Awaited<ReturnType<typeof listProgramCourses>>;
type Labels = Awaited<ReturnType<typeof listSectionLabels>>;
type Analytics = Awaited<ReturnType<typeof getBatchAnalytics>>;

export default function BatchDetailPage({ params }: { params: Promise<{ programId: string; batchId: string }> }) {
  const { programId, batchId } = use(params);
  const { user } = useAuth();
  const [batch, setBatch] = useState<Batch | null>(null);
  const [loading, setLoading] = useState(true);

  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  const load = useCallback(() => {
    getBatchDetail(batchId).then(setBatch).finally(() => setLoading(false));
  }, [batchId]);
  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);

  if (!user) return null;
  if (!isAdmin) return <div className="p-8 text-center text-muted-foreground">Access denied.</div>;
  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!batch) return <div className="p-8 text-center text-muted-foreground">Batch not found.</div>;

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <Link href={`/dashboard/programs/${programId}`} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2">
          <ChevronLeft className="h-3.5 w-3.5" /> {batch.program.name}
        </Link>
        <h1 className="text-2xl md:text-3xl font-black tracking-tighter uppercase">{batch.program.name} · {batch.label}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{batch.students.length} students · {batch.sections.length} sections</p>
      </div>

      <Tabs defaultValue="roster">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="roster"><Users className="h-4 w-4 mr-1.5" /> Roster</TabsTrigger>
          <TabsTrigger value="sections"><GraduationCap className="h-4 w-4 mr-1.5" /> Sections & Courses</TabsTrigger>
          <TabsTrigger value="timetable"><CalendarDays className="h-4 w-4 mr-1.5" /> Timetable</TabsTrigger>
          <TabsTrigger value="analytics"><BarChart3 className="h-4 w-4 mr-1.5" /> Analytics</TabsTrigger>
        </TabsList>
        <TabsContent value="roster" className="pt-4">
          <RosterTab batch={batch} onChanged={load} />
        </TabsContent>
        <TabsContent value="sections" className="pt-4">
          <SectionsTab batch={batch} programId={programId} onChanged={load} />
        </TabsContent>
        <TabsContent value="timetable" className="pt-4">
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Pick one of this batch&apos;s sections and click empty cells to place classes — every option that
              can&apos;t be used at that time is greyed out with the reason.
            </p>
            <SectionBuilder filterBatchId={batch.id} />
          </div>
        </TabsContent>
        <TabsContent value="analytics" className="pt-4">
          <AnalyticsTab batchId={batch.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Roster tab ─────────────────────────────────────────────────────────────

function RosterTab({ batch, onChanged }: { batch: Batch; onChanged: () => void }) {
  const [q, setQ] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [assignStudent, setAssignStudent] = useState<Batch["students"][number] | null>(null);

  const shown = batch.students.filter((s) =>
    !q || (s.name + " " + (s.rollNo ?? "") + " " + s.email).toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, roll no, email…" className="h-9 pl-8" />
        </div>
        <Button size="sm" variant="outline" onClick={() => setAddOpen(true)} title="Fallback: place a student who was onboarded without a batch into this one">
          <UserPlus className="h-4 w-4 mr-1.5" /> Add unbatched students
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Students land here automatically when onboarded into this programme &amp; batch in{" "}
        <Link href="/dashboard/admin/users" className="text-primary font-semibold underline">User Management</Link> (individually or via CSV bulk-onboard).
        Section placement happens under <b>Sections &amp; Courses</b>.
      </p>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Roll No</TableHead>
                <TableHead className="text-xs">Name</TableHead>
                <TableHead className="text-xs">Email</TableHead>
                <TableHead className="text-xs">Sem</TableHead>
                <TableHead className="text-xs w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="text-xs font-medium">{s.rollNo ?? "—"}</TableCell>
                  <TableCell className="text-xs">{s.name}{!s.isActive && <Badge variant="secondary" className="ml-1.5 text-[9px]">inactive</Badge>}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{s.email}</TableCell>
                  <TableCell className="text-xs">{s.currentSemester ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="outline" className="h-7 text-[11px] px-2" onClick={() => setAssignStudent(s)}>
                        <GraduationCap className="h-3.5 w-3.5 mr-1" /> Sections
                      </Button>
                      <button
                        type="button" title="Remove from batch" className="text-destructive p-1"
                        onClick={async () => {
                          if (!confirm(`Remove ${s.name} from this batch?`)) return;
                          const res = await removeStudentFromBatch(batch.id, s.id);
                          if (res.success) { toast.success("Removed from batch"); onChanged(); }
                          else toast.error(res.error, { duration: 6000 });
                        }}
                      ><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {shown.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-8">
                  {batch.students.length === 0 ? "No students in this batch yet — onboard them in User Management, or assign existing ones here." : "No students match your search."}
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {addOpen && <AddExistingDialog batchId={batch.id} onClose={() => setAddOpen(false)} onChanged={onChanged} />}
      {assignStudent && (
        <StudentSectionsDialog
          student={assignStudent}
          onClose={() => setAssignStudent(null)}
          onChanged={onChanged}
        />
      )}
    </div>
  );
}

/** Student-centric placement: pick a semester, set the one core section and
 *  any number of elective sections the student sits in. */
function StudentSectionsDialog({ student, onClose, onChanged }: {
  student: Batch["students"][number]; onClose: () => void; onChanged: () => void;
}) {
  const [data, setData] = useState<Awaited<ReturnType<typeof getStudentSectionPlacement>> | null>(null);
  const [sem, setSem] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => { getStudentSectionPlacement(student.id).then(setData); }, [student.id]);
  useEffect(() => { load(); }, [load]);

  // default the semester picker to the first one that has sections
  useEffect(() => {
    if (data && sem == null && data.sections.length > 0) {
      const enrolled = data.sections.find((s) => s.enrolled);
      setSem(enrolled?.semester ?? data.sections[0].semester);
    }
  }, [data, sem]);

  const setCore = async (sectionId: string) => {
    setBusyId(sectionId);
    const res = await enrollStudentInSection(sectionId, student.id);
    setBusyId(null);
    if (res.success) { toast.success("Core section set"); load(); onChanged(); }
    else toast.error(res.error, { duration: 6000 });
  };
  const toggleElective = async (sectionId: string, enrolled: boolean) => {
    setBusyId(sectionId);
    const res = enrolled ? await removeStudentFromSection(sectionId, student.id) : await enrollStudentInSection(sectionId, student.id);
    setBusyId(null);
    if (res.success) { toast.success(enrolled ? "Removed from elective" : "Added to elective"); load(); onChanged(); }
    else toast.error(res.error, { duration: 6000 });
  };
  const clearCore = async (sectionId: string) => {
    setBusyId(sectionId);
    const res = await removeStudentFromSection(sectionId, student.id);
    setBusyId(null);
    if (res.success) { toast.success("Removed from core section"); load(); onChanged(); }
    else toast.error(res.error, { duration: 6000 });
  };

  const semesters = data ? [...new Set(data.sections.map((s) => s.semester))].sort((a, b) => a - b) : [];
  const inSem = data?.sections.filter((s) => s.semester === sem) ?? [];
  const coreSections = inSem.filter((s) => s.type === "CORE" || s.type === "MIXED");
  const electiveSections = inSem.filter((s) => s.type === "ELECTIVE");
  const currentCore = coreSections.find((s) => s.enrolled);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">Assign sections — {student.name}</DialogTitle>
          <DialogDescription>
            One core section plus any number of electives, per semester. You can assign a section even
            before it has courses — the student is enrolled into its courses automatically as they&apos;re added.
          </DialogDescription>
        </DialogHeader>

        {!data ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : data.sections.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            This batch has no sections yet — create them under <b>Sections &amp; Courses</b> first.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-muted-foreground">Semester</label>
              <Select value={sem ? String(sem) : ""} onValueChange={(v) => setSem(Number(v))}>
                <SelectTrigger className="h-8 w-28 text-xs"><SelectValue placeholder="Pick" /></SelectTrigger>
                <SelectContent>
                  {semesters.map((n) => <SelectItem key={n} value={String(n)}>Semester {n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Core section — single choice */}
            <div className="space-y-1.5">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Core section</p>
              {coreSections.length === 0 ? (
                <p className="text-xs text-muted-foreground">No core sections in Sem {sem}.</p>
              ) : (
                <div className="border rounded-lg divide-y">
                  {coreSections.map((s) => {
                    const isCurrent = s.id === currentCore?.id;
                    return (
                      <div key={s.id} className="flex items-center justify-between px-3 py-2 text-sm">
                        <span>Section {s.name} <span className="text-muted-foreground text-xs">· {s.courseCount} course{s.courseCount === 1 ? "" : "s"}</span></span>
                        {isCurrent ? (
                          <Button size="sm" variant="outline" className="h-7 text-[11px]" disabled={busyId === s.id} onClick={() => clearCore(s.id)}>
                            {busyId === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Enrolled ✓ — remove"}
                          </Button>
                        ) : (
                          <Button size="sm" className="h-7 text-[11px]" disabled={busyId === s.id} onClick={() => setCore(s.id)}>
                            {busyId === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : currentCore ? "Switch here" : "Set as core"}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Electives — multiple */}
            <div className="space-y-1.5">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Elective sections</p>
              {electiveSections.length === 0 ? (
                <p className="text-xs text-muted-foreground">No elective sections in Sem {sem}.</p>
              ) : (
                <div className="border rounded-lg divide-y">
                  {electiveSections.map((s) => (
                    <label key={s.id} className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer hover:bg-muted/40">
                      <input
                        type="checkbox" checked={s.enrolled} className="h-4 w-4"
                        disabled={busyId === s.id}
                        onChange={() => toggleElective(s.id, s.enrolled)}
                      />
                      <span className="flex-1">Section {s.name} <span className="text-muted-foreground text-xs">· {s.courseCount} course{s.courseCount === 1 ? "" : "s"}</span></span>
                      {busyId === s.id && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AddExistingDialog({ batchId, onClose, onChanged }: { batchId: string; onClose: () => void; onChanged: () => void }) {
  const [candidates, setCandidates] = useState<Awaited<ReturnType<typeof listUnbatchedStudents>>>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { listUnbatchedStudents(batchId).then(setCandidates).catch(() => {}); }, [batchId]);
  const shown = candidates.filter((c) => !q || (c.name + " " + (c.rollNo ?? "") + " " + c.email).toLowerCase().includes(q.toLowerCase()));
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const save = async () => {
    setBusy(true);
    const res = await addStudentsToBatch(batchId, [...picked]);
    setBusy(false);
    if (res.success) { toast.success(`${picked.size} student(s) added`); onChanged(); onClose(); }
    else toast.error(res.error);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add students to this batch</DialogTitle>
          <DialogDescription>Onboarded students of this programme who aren&apos;t in any batch yet.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="h-9" />
          <div className="max-h-72 overflow-y-auto border rounded-lg divide-y">
            {shown.map((c) => (
              <label key={c.id} className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer hover:bg-muted/40">
                <input type="checkbox" checked={picked.has(c.id)} onChange={() => toggle(c.id)} className="h-4 w-4" />
                <span className="font-medium">{c.rollNo ?? "—"}</span>
                <span className="text-muted-foreground truncate">{c.name} · {c.email}</span>
              </label>
            ))}
            {shown.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">No unbatched students of this programme found.</p>}
          </div>
          <Button className="w-full" disabled={busy || picked.size === 0} onClick={save}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Add {picked.size > 0 ? picked.size : ""} to batch
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Reusable "upload a roll-number CSV" dialog. The caller does the actual
 *  work via onSubmit and returns a per-row result. */
function RollNumberCsvDialog({ title, description, onSubmit, onClose, onChanged }: {
  title: string;
  description: string;
  onSubmit: (rollNumbers: string[]) => Promise<{ ok: number; failed: { row: number; rollNo: string; reason: string }[]; error: string | null }>;
  onClose: () => void;
  onChanged: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Record<string, string>[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: number; failed: { row: number; rollNo: string; reason: string }[] } | null>(null);

  const template = () => downloadCsv("chalkzone-rollno-template.csv", toCsv(["rollNo"], [["CS2026-001"], ["CS2026-002"]]));

  const onFile = async (f: File) => {
    setFileName(f.name);
    const parsed = parseCsv(await f.text());
    if (parsed.length === 0) { toast.error("Couldn't read any data rows — the file needs a header row (rollNo) plus one roll number per line."); return; }
    setRows(parsed);
    setResult(null);
  };

  const run = async () => {
    if (!rows) return;
    setBusy(true);
    const rolls = rows.map((r) => r.rollno ?? r["roll no"] ?? r.roll ?? "");
    const res = await onSubmit(rolls);
    setBusy(false);
    if (res.error) { toast.error(res.error); return; }
    setResult({ ok: res.ok, failed: res.failed });
    if (res.ok > 0) onChanged();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {!result ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs space-y-2">
              <p className="font-semibold inline-flex items-center gap-1.5"><FileSpreadsheet className="h-4 w-4 text-primary" /> Step 1 — get the template</p>
              <p className="text-muted-foreground">One column: <b>rollNo</b>, one student per line.</p>
              <Button size="sm" variant="outline" onClick={template}><Download className="h-4 w-4 mr-1.5" /> Download template</Button>
            </div>
            <div className="rounded-lg border p-3 text-xs space-y-2">
              <p className="font-semibold">Step 2 — upload your filled file</p>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
              <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4 mr-1.5" /> Choose CSV file</Button>
              {fileName && <p className="text-muted-foreground">Loaded <b>{fileName}</b> — {rows?.length ?? 0} row(s) ready.</p>}
            </div>
            <Button className="w-full" disabled={busy || !rows || rows.length === 0} onClick={run}>
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Process {rows?.length ?? 0} row(s)
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-5 w-5 text-green-500" /><span><b>{result.ok}</b> student(s) processed.</span>
            </div>
            {result.failed.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                  <XCircle className="h-5 w-5" /> <b>{result.failed.length}</b> row(s) skipped:
                </div>
                <div className="max-h-40 overflow-auto border rounded-lg text-xs divide-y">
                  {result.failed.map((f, i) => (
                    <div key={i} className="px-2.5 py-1.5 flex justify-between gap-2">
                      <span>Row {f.row} <span className="text-muted-foreground">{f.rollNo}</span></span>
                      <span className="text-destructive text-right">{f.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <Button className="w-full" onClick={onClose}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Sections & Courses tab ─────────────────────────────────────────────────

function SectionsTab({ batch, programId, onChanged }: { batch: Batch; programId: string; onChanged: () => void }) {
  const [labels, setLabels] = useState<Labels>([]);
  const [courses, setCourses] = useState<ProgramCourses>([]);
  const [faculty, setFaculty] = useState<FacultyOpts>([]);
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [manageSection, setManageSection] = useState<Batch["sections"][number] | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editSection, setEditSection] = useState<Batch["sections"][number] | null>(null);

  useEffect(() => {
    listSectionLabels().then(setLabels).catch(() => {});
    listProgramCourses(programId).then(setCourses).catch(() => {});
    listFacultyOptions().then(setFaculty).catch(() => {});
  }, [programId]);

  const bySem = new Map<number, Batch["sections"]>();
  for (const s of batch.sections) {
    if (!bySem.has(s.semester)) bySem.set(s.semester, []);
    bySem.get(s.semester)!.push(s);
  }
  const semesters = [...bySem.keys()].sort((a, b) => a - b);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground max-w-xl">
          Create sections from your configured labels, attach this programme&apos;s courses with a faculty
          member each, then enroll students. Core sections enroll a student into all their courses at once.
        </p>
        <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-1.5" /> New section</Button>
      </div>

      {batch.sections.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No sections yet — create the first one. Section names come from{" "}
            <Link href="/dashboard/admin/config" className="text-primary font-semibold underline">Configuration → Section Labels</Link>.
          </CardContent>
        </Card>
      ) : (
        semesters.map((sem) => (
          <div key={sem} className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Semester {sem}</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {bySem.get(sem)!.map((s) => (
                <Card key={s.id}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold">Section {s.name}</span>
                      <span className="flex items-center gap-1">
                        <Badge variant="outline" className="text-[9px]">{s.type}</Badge>
                        <button type="button" title="Edit section" className="text-muted-foreground hover:text-foreground p-0.5" onClick={() => setEditSection(s)}><Pencil className="h-3.5 w-3.5" /></button>
                        <button type="button" title="Delete section" className="text-destructive p-0.5" onClick={async () => {
                          if (!confirm(`Delete section ${s.name} (Sem ${s.semester})?`)) return;
                          const res = await deleteBatchSection(s.id);
                          if (res.success) { toast.success("Section deleted"); onChanged(); } else toast.error(res.error, { duration: 6000 });
                        }}><Trash2 className="h-3.5 w-3.5" /></button>
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{s.courseCount} course{s.courseCount === 1 ? "" : "s"} · {s.enrolled} student{s.enrolled === 1 ? "" : "s"}</p>
                    <div className="grid grid-cols-2 gap-2 pt-0.5">
                      <Button size="sm" variant="outline" className="h-8 text-[11px]" onClick={() => setManageSection(s)}>
                        <BookOpen className="h-3.5 w-3.5 mr-1" /> Courses & faculty
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 text-[11px]" onClick={() => setOpenSection(s.id)}>
                        <Users className="h-3.5 w-3.5 mr-1" /> Students
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))
      )}

      {(createOpen || editSection) && (
        <SectionFormDialog
          batchId={batch.id}
          labels={labels}
          section={editSection}
          onClose={() => { setCreateOpen(false); setEditSection(null); }}
          onChanged={onChanged}
        />
      )}
      {manageSection && (
        <SectionCoursesDialog
          section={manageSection}
          courses={courses}
          faculty={faculty}
          onClose={() => setManageSection(null)}
          onChanged={onChanged}
        />
      )}
      {openSection && (
        <SectionEnrollmentDialog sectionId={openSection} onClose={() => setOpenSection(null)} onChanged={onChanged} />
      )}
    </div>
  );
}

function SectionFormDialog({ batchId, labels, section, onClose, onChanged }: {
  batchId: string; labels: Labels; section: Batch["sections"][number] | null; onClose: () => void; onChanged: () => void;
}) {
  const [labelId, setLabelId] = useState("");
  const [semester, setSemester] = useState(section ? String(section.semester) : "1");
  const [type, setType] = useState<"CORE" | "ELECTIVE" | "MIXED">(section?.type ?? "CORE");
  const [count, setCount] = useState(section ? String(section.studentCount) : "60");
  const [weekStart, setWeekStart] = useState("MON");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (section) {
      const match = labels.find((l) => l.name === section.name);
      if (match) setLabelId(match.id);
    }
  }, [section, labels]);

  const save = async () => {
    setBusy(true);
    const res = await saveBatchSection({
      id: section?.id,
      batchId, labelId,
      semester: Number(semester),
      type, studentCount: Number(count) || 0, weekStart,
    });
    setBusy(false);
    if (res.success) { toast.success(section ? "Section updated" : "Section created"); onChanged(); onClose(); }
    else toast.error(res.error, { duration: 6000 });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{section ? `Edit Section ${section.name}` : "New section"}</DialogTitle>
          <DialogDescription>Section names come from Configuration → Section Labels.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground">Section label</label>
            <Select value={labelId} onValueChange={(v) => setLabelId(v || "")}>
              <SelectTrigger className="h-9 text-xs" title="Reusable name from Configuration → Section Labels"><SelectValue placeholder="Pick label" /></SelectTrigger>
              <SelectContent>
                {labels.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                {labels.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">No labels — create them in Configuration</div>}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground">Semester (1–12)</label>
            <Input type="number" min={1} max={12} value={semester} onChange={(e) => setSemester(e.target.value)} className="h-9" title="Which semester this section runs in" />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground">Type</label>
            <Select value={type} onValueChange={(v) => setType((v as typeof type) || "CORE")}>
              <SelectTrigger className="h-9 text-xs" title="Core = home class group; Elective = opt-in group"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CORE">Core</SelectItem>
                <SelectItem value="ELECTIVE">Elective</SelectItem>
                <SelectItem value="MIXED">Mixed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground">Capacity</label>
            <Input type="number" value={count} onChange={(e) => setCount(e.target.value)} className="h-9" title="Expected number of students — rooms smaller than this get flagged" />
          </div>
          <div className="space-y-1 col-span-2">
            <label className="text-[11px] font-semibold text-muted-foreground">Attendance window</label>
            <Select value={weekStart} onValueChange={(v) => setWeekStart(v || "MON")}>
              <SelectTrigger className="h-9 text-xs" title="The 5 consecutive days this section attends"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DAYS.map((d) => <SelectItem key={d} value={d}>Attends {windowLabel(d)} (5 days)</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button className="w-full" disabled={busy || !labelId} onClick={save}>
          {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} {section ? "Save changes" : "Create section"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function SectionCoursesDialog({ section, courses, faculty, onClose, onChanged }: {
  section: Batch["sections"][number]; courses: ProgramCourses; faculty: FacultyOpts; onClose: () => void; onChanged: () => void;
}) {
  const [assignments, setAssignments] = useState<Awaited<ReturnType<typeof listSectionAssignments>>>([]);
  const [subjectId, setSubjectId] = useState("");
  const [facultyId, setFacultyId] = useState("");
  const [hours, setHours] = useState("3");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => { listSectionAssignments(section.id).then(setAssignments).catch(() => {}); }, [section.id]);
  useEffect(() => { load(); }, [load]);

  // Courses of this programme valid for this section's semester
  const offered = courses.filter((c) => c.semester == null || c.semester === section.semester);
  const notYetAttached = offered.filter((c) => !assignments.some((a) => a.subjectId === c.id));

  const attach = async () => {
    if (!subjectId || !facultyId) return toast.error("Pick a course and a faculty member");
    setBusy(true);
    const res = await saveSectionCourseFaculty({ sectionId: section.id, subjectId, facultyProfileId: facultyId, weeklyHours: Number(hours) || 3 });
    setBusy(false);
    if (res.success) { toast.success("Course attached"); setSubjectId(""); setFacultyId(""); load(); onChanged(); }
    else toast.error(res.error, { duration: 7000 });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Section {section.name} · Sem {section.semester} — courses & faculty</DialogTitle>
          <DialogDescription>
            Attach this programme&apos;s courses and pick who teaches each. Faculty can teach any number of
            programmes, courses and sections — only their weekly-hour cap limits them.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1 min-w-0">
              <label className="text-[11px] font-semibold text-muted-foreground">Course</label>
              <Select value={subjectId} onValueChange={(v) => setSubjectId(v || "")}>
                <SelectTrigger className="h-9 text-xs" title="Programme courses valid for this semester"><SelectValue placeholder="Pick course" /></SelectTrigger>
                <SelectContent>
                  {notYetAttached.map((c) => <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>)}
                  {notYetAttached.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">All eligible courses attached — import more on the programme page</div>}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 min-w-0">
              <label className="text-[11px] font-semibold text-muted-foreground">Faculty</label>
              <Select value={facultyId} onValueChange={(v) => setFacultyId(v || "")}>
                <SelectTrigger className="h-9 text-xs" title="Who teaches this course in this section"><SelectValue placeholder="Pick faculty" /></SelectTrigger>
                <SelectContent>
                  {faculty.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.name} · {f.assigned}/{f.cap}h{f.designation ? ` · ${f.designation}` : ""}</SelectItem>
                  ))}
                  {faculty.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">No faculty onboarded yet</div>}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-end gap-2">
            <div className="space-y-1 w-24">
              <label className="text-[11px] font-semibold text-muted-foreground">Hours/week</label>
              <Input type="number" min={1} max={20} value={hours} onChange={(e) => setHours(e.target.value)} className="h-9" title="Weekly teaching hours for this course in this section" />
            </div>
            <Button size="sm" className="h-9 flex-1" disabled={busy} onClick={attach}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 mr-1" /> Attach course</>}
            </Button>
          </div>
        </div>

        <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
          {assignments.map((a) => (
            <div key={a.id} className="flex items-center justify-between px-3 py-2 text-xs">
              <span><b>{a.subject.code}</b> {a.subject.name} <span className="text-muted-foreground">· {a.faculty.user.name} · {a.weeklyHours}h/wk · {a._count.slots} placed</span></span>
              <button type="button" title="Detach course from section" className="text-destructive" onClick={async () => {
                if (!confirm(`Detach ${a.subject.code} from this section? Its placed classes are removed too.`)) return;
                await removeSectionCourse(a.id);
                toast.success("Detached"); load(); onChanged();
              }}><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
          {assignments.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">No courses attached yet.</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Enrollment dialog (unchanged behaviour) ────────────────────────────────

function SectionEnrollmentDialog({ sectionId, onClose, onChanged }: { sectionId: string; onClose: () => void; onChanged: () => void }) {
  const [data, setData] = useState<Enrollment | null>(null);
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);

  const load = useCallback(() => { getSectionEnrollment(sectionId).then((d) => { setData(d); setPicked(new Set()); }); }, [sectionId]);
  useEffect(() => { load(); }, [load]);

  const remove = async (studentProfileId: string) => {
    setBusyId(studentProfileId);
    const res = await removeStudentFromSection(sectionId, studentProfileId);
    setBusyId(null);
    if (res.success) { toast.success("Removed from section"); load(); onChanged(); }
    else toast.error(res.error, { duration: 6000 });
  };

  const enrollOne = async (studentProfileId: string) => {
    setBusyId(studentProfileId);
    const res = await enrollStudentInSection(sectionId, studentProfileId);
    setBusyId(null);
    if (res.success) { toast.success("Enrolled"); load(); onChanged(); }
    else toast.error(res.error, { duration: 6000 });
  };

  const candidates = (data?.candidates ?? []).filter((c) => !q || (c.name + " " + (c.rollNo ?? "")).toLowerCase().includes(q.toLowerCase()));
  const noCourses = !!data && data.courses.length === 0;
  const isElective = data?.type === "ELECTIVE";

  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allShownPicked = candidates.length > 0 && candidates.every((c) => picked.has(c.studentProfileId));
  const toggleAll = () => setPicked((p) => {
    if (allShownPicked) { const n = new Set(p); candidates.forEach((c) => n.delete(c.studentProfileId)); return n; }
    return new Set([...p, ...candidates.map((c) => c.studentProfileId)]);
  });

  const enrollSelected = async () => {
    if (picked.size === 0) return;
    setBulkBusy(true);
    const res = await enrollStudentsInSection(sectionId, [...picked]);
    setBulkBusy(false);
    if (res.success) {
      toast.success(`${res.enrolled} enrolled${res.skipped ? `, ${res.skipped} skipped` : ""}`);
      load(); onChanged();
    } else toast.error(res.error, { duration: 6000 });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-base">{data?.label ?? "Section"}</DialogTitle>
          <DialogDescription>
            {isElective
              ? "Elective section — add students who opt in. A student can be in only one section per course."
              : "Core section — adding a student enrolls them into all this section's courses. A student can be in only one core section per course."}
            {noCourses && <span className="text-amber-600 dark:text-amber-400"> No courses attached yet — you can still add students; they are enrolled automatically when you attach courses.</span>}
          </DialogDescription>
        </DialogHeader>

        {!data ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Enrolled */}
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Enrolled ({data.roster.length})</p>
              <div className="max-h-72 overflow-y-auto border rounded-lg divide-y">
                {data.roster.map((r) => (
                  <div key={r.studentProfileId} className="flex items-center justify-between px-2.5 py-1.5 text-xs">
                    <span className="truncate">
                      <b>{r.rollNo ?? "—"}</b> {r.name}
                      {r.courseCount < r.ofCourses && <Badge variant="secondary" className="ml-1 text-[9px]">{r.courseCount}/{r.ofCourses} courses</Badge>}
                    </span>
                    <button type="button" title="Remove from section" className="text-destructive shrink-0" disabled={busyId === r.studentProfileId} onClick={() => remove(r.studentProfileId)}>
                      {busyId === r.studentProfileId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                ))}
                {data.roster.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">No one enrolled yet.</p>}
              </div>
            </div>

            {/* Add from batch — multi-select + CSV */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Add from batch</p>
                <button type="button" className="text-[11px] text-primary font-semibold hover:underline inline-flex items-center gap-1 disabled:opacity-40" onClick={() => setCsvOpen(true)}>
                  <Upload className="h-3 w-3" /> CSV
                </button>
              </div>
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search batch…" className="h-8 text-xs" />
              {candidates.length > 0 && (
                <label className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground px-0.5 cursor-pointer">
                  <input type="checkbox" checked={allShownPicked} onChange={toggleAll} className="h-3.5 w-3.5" />
                  Select all shown ({candidates.length})
                </label>
              )}
              <div className="max-h-56 overflow-y-auto border rounded-lg divide-y">
                {candidates.map((c) => (
                  <div key={c.studentProfileId} className="flex items-center gap-2 px-2.5 py-1.5 text-xs">
                    <input type="checkbox" checked={picked.has(c.studentProfileId)} onChange={() => toggle(c.studentProfileId)} className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate flex-1">
                      <b>{c.rollNo ?? "—"}</b> {c.name}
                      {c.movesFrom && <span className="block text-[10px] text-amber-600 dark:text-amber-400">switches from Sec {c.movesFrom}</span>}
                    </span>
                    <button type="button" title="Enroll just this student" className="text-primary shrink-0" disabled={busyId === c.studentProfileId} onClick={() => enrollOne(c.studentProfileId)}>
                      {busyId === c.studentProfileId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                ))}
                {candidates.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">No batch students to add.</p>}
              </div>
              {picked.size > 0 && (
                <Button size="sm" className="w-full" disabled={bulkBusy} onClick={enrollSelected}>
                  {bulkBusy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserPlus className="h-4 w-4 mr-2" />} Enroll {picked.size} selected
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>

      {csvOpen && (
        <RollNumberCsvDialog
          title={`Enroll into Section ${data?.label ?? ""} via CSV`}
          description="Enroll batch students into this section by roll number. Students not in this batch are skipped and reported."
          onSubmit={(rolls) => enrollStudentsCsvIntoSection(sectionId, rolls)}
          onClose={() => setCsvOpen(false)}
          onChanged={() => { load(); onChanged(); }}
        />
      )}
    </Dialog>
  );
}

// ─── Analytics tab ──────────────────────────────────────────────────────────

function AnalyticsTab({ batchId }: { batchId: string }) {
  const [rows, setRows] = useState<Analytics | null>(null);
  useEffect(() => { getBatchAnalytics(batchId).then(setRows).catch(() => setRows([])); }, [batchId]);

  if (!rows) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (rows.length === 0 || rows.every((s) => s.courses.length === 0)) {
    return (
      <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
        Analytics appear once sections have courses, attendance sessions and marks.
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-5">
      {rows.filter((s) => s.courses.length > 0).map((s) => (
        <div key={s.sectionId} className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Sem {s.semester} · Section {s.name} <Badge variant="outline" className="ml-1 text-[9px]">{s.type}</Badge></h3>
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Course</TableHead>
                    <TableHead className="text-xs">Faculty</TableHead>
                    <TableHead className="text-xs text-right">Sessions</TableHead>
                    <TableHead className="text-xs text-right">Attendance</TableHead>
                    <TableHead className="text-xs text-right">Avg marks</TableHead>
                    <TableHead className="text-xs text-right">Avg grade pt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {s.courses.map((c) => (
                    <TableRow key={c.code}>
                      <TableCell className="text-xs font-medium">{c.code} <span className="text-muted-foreground">{c.name}</span></TableCell>
                      <TableCell className="text-xs">{c.faculty ?? "—"}</TableCell>
                      <TableCell className="text-xs text-right">{c.sessions}</TableCell>
                      <TableCell className={`text-xs text-right font-semibold ${c.attendancePct == null ? "text-muted-foreground" : c.attendancePct >= 75 ? "text-green-600 dark:text-green-400" : c.attendancePct >= 65 ? "text-amber-600 dark:text-amber-400" : "text-red-500"}`}>
                        {c.attendancePct == null ? "—" : `${c.attendancePct}%`}
                      </TableCell>
                      <TableCell className="text-xs text-right">{c.avgMarks ?? "—"}</TableCell>
                      <TableCell className="text-xs text-right">{c.avgGradePoint ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  );
}
