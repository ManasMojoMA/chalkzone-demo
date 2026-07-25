"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { getProgramDetail, listProgramCourses, updateProgramCourse } from "../actions";
import { importCourseToProgram, listCourseMaster } from "@/app/dashboard/admin/config/actions";
import { deleteSubject } from "@/app/dashboard/timetable/actions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Layers, Users, LayoutGrid, ArrowRight, ChevronLeft, Wrench, BookOpen, Trash2, RefreshCw, Download, Pencil } from "lucide-react";
import { toast } from "sonner";

type Detail = Awaited<ReturnType<typeof getProgramDetail>>;
type Courses = Awaited<ReturnType<typeof listProgramCourses>>;
type Master = Awaited<ReturnType<typeof listCourseMaster>>;

export default function ProgramDetailPage({ params }: { params: Promise<{ programId: string }> }) {
  const { programId } = use(params);
  const { user } = useAuth();
  const [data, setData] = useState<Detail | null>(null);
  const [courses, setCourses] = useState<Courses>([]);
  const [master, setMaster] = useState<Master>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  const load = useCallback(() => {
    Promise.all([getProgramDetail(programId), listProgramCourses(programId), listCourseMaster()])
      .then(([d, c, m]) => { setData(d); setCourses(c); setMaster(m); })
      .finally(() => setLoading(false));
  }, [programId]);
  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);

  if (!user) return null;
  if (!isAdmin) return <div className="p-8 text-center text-muted-foreground">Access denied.</div>;
  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!data) return <div className="p-8 text-center text-muted-foreground">Programme not found.</div>;

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <Link href="/dashboard/programs" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2">
          <ChevronLeft className="h-3.5 w-3.5" /> All programmes
        </Link>
        <h1 className="text-2xl md:text-3xl font-black tracking-tighter uppercase">{data.name}</h1>
        <p className="text-muted-foreground mt-1 text-sm">Manage this programme&apos;s batches and its course list.</p>
      </div>

      <Tabs defaultValue="batches">
        <TabsList>
          <TabsTrigger value="batches"><Layers className="h-4 w-4 mr-1.5" /> Batches</TabsTrigger>
          <TabsTrigger value="courses"><BookOpen className="h-4 w-4 mr-1.5" /> Courses</TabsTrigger>
        </TabsList>

        <TabsContent value="batches" className="pt-4">
          {data.batches.length === 0 ? (
            <Card>
              <CardContent className="py-14 text-center text-sm text-muted-foreground space-y-2">
                <p>No batches for this programme yet.</p>
                <p className="inline-flex items-center gap-1.5">
                  <Wrench className="h-4 w-4" /> Create one in{" "}
                  <Link href="/dashboard/admin/config" className="text-primary font-semibold underline">Configuration → Batches</Link>.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.batches.map((b) => (
                <Link key={b.id} href={`/dashboard/programs/${programId}/${b.id}`} className="group">
                  <Card className="h-full transition-all group-hover:-translate-y-0.5 group-hover:shadow-md">
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-start justify-between">
                        <h2 className="font-bold text-lg inline-flex items-center gap-2"><Layers className="h-4 w-4 text-primary" /> {b.label}</h2>
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0" />
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {b.studentCount} students</span>
                        <span className="inline-flex items-center gap-1"><LayoutGrid className="h-3.5 w-3.5" /> {b.sectionCount} sections</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="courses" className="pt-4 max-w-3xl">
          <ProgramCoursesTab programId={programId} courses={courses} master={master} onChanged={load} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Courses tab: import copies from the Course Master ──────────────────────

function ProgramCoursesTab({ programId, courses, master, onChanged }: {
  programId: string; courses: Courses; master: Master; onChanged: () => void;
}) {
  const [masterId, setMasterId] = useState("");
  const [semester, setSemester] = useState("");
  const [busy, setBusy] = useState(false);
  const [editCourse, setEditCourse] = useState<Courses[number] | null>(null);

  const alreadyImported = new Set(courses.map((c) => c.courseMaster?.id).filter(Boolean));
  const available = master.filter((m) => !alreadyImported.has(m.id));

  const runImport = async () => {
    if (!masterId) return toast.error("Pick a course from the master catalogue");
    setBusy(true);
    const res = await importCourseToProgram(masterId, programId, semester ? Number(semester) : null);
    setBusy(false);
    if (res.success) { toast.success(res.refreshed ? "Course refreshed from master" : "Course imported"); setMasterId(""); setSemester(""); onChanged(); }
    else toast.error(res.error);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-5 space-y-3">
          <p className="text-sm font-semibold inline-flex items-center gap-1.5"><Download className="h-4 w-4 text-primary" /> Import a course from the Course Master</p>
          <p className="text-xs text-muted-foreground">
            This creates the programme&apos;s own copy — editing or removing it here never affects the master
            or other programmes. Author new courses in{" "}
            <Link href="/dashboard/admin/config" className="text-primary font-semibold underline">Configuration → Course Master</Link>.
          </p>
          <div className="grid grid-cols-[2fr_1fr_auto] gap-2 items-end">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground">Course</label>
              <Select value={masterId} onValueChange={(v) => setMasterId(v || "")}>
                <SelectTrigger className="h-9 text-xs" title="Courses in the master catalogue not yet imported here"><SelectValue placeholder="Pick a course…" /></SelectTrigger>
                <SelectContent>
                  {available.map((m) => <SelectItem key={m.id} value={m.id}>{m.code} — {m.name} ({m.credits} cr)</SelectItem>)}
                  {available.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">All master courses are already imported</div>}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground">Semester (blank = all)</label>
              <Input type="number" min={1} max={12} placeholder="1" value={semester} onChange={(e) => setSemester(e.target.value)} className="h-9" title="Offer this course only in one semester — leave blank to offer across the programme" />
            </div>
            <Button size="sm" className="h-9" disabled={busy || !masterId} onClick={runImport}>
              {busy && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />} Import
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-1.5">
        {courses.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-xs">
            <span className="min-w-0">
              <span className="font-semibold">{c.code} — {c.name}</span>{" "}
              <span className="text-muted-foreground">
                · {c.semester ? `Sem ${c.semester}` : "all semesters"} · {c.credits} cr
                {c._count.sectionAssignments > 0 && ` · taught in ${c._count.sectionAssignments} section${c._count.sectionAssignments > 1 ? "s" : ""}`}
                {c._count.courseEnrollments > 0 && ` · ${c._count.courseEnrollments} enrolled`}
              </span>
            </span>
            <span className="flex items-center gap-1.5 shrink-0 ml-2">
              <button type="button" title={`Edit ${c.code} for this programme`} className="text-muted-foreground hover:text-foreground p-1" onClick={() => setEditCourse(c)}>
                <Pencil className="h-3.5 w-3.5" />
              </button>
              {c.courseMaster && (
                <button
                  type="button"
                  title="Overwrite this copy's name & credits from the Course Master (discards local edits)"
                  className="text-muted-foreground hover:text-foreground p-1"
                  onClick={async () => {
                    if (!confirm(`Refresh ${c.code} from the master? This overwrites any local edits to its name and credits.`)) return;
                    const res = await importCourseToProgram(c.courseMaster!.id, programId, c.semester);
                    if (res.success) { toast.success("Refreshed from master"); onChanged(); } else toast.error(res.error);
                  }}
                ><RefreshCw className="h-3.5 w-3.5" /></button>
              )}
              <button
                type="button" title={`Remove ${c.code} from this programme`} className="text-destructive p-1"
                onClick={async () => {
                  if (!confirm(`Remove ${c.code} from this programme? The master copy stays intact.`)) return;
                  const res = await deleteSubject(c.id);
                  if (res.success) { toast.success("Removed from programme"); onChanged(); } else toast.error(res.error, { duration: 7000 });
                }}
              ><Trash2 className="h-3.5 w-3.5" /></button>
            </span>
          </div>
        ))}
        {courses.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-8">No courses imported into this programme yet.</p>
        )}
      </div>

      {editCourse && <CourseEditDialog course={editCourse} onClose={() => setEditCourse(null)} onChanged={onChanged} />}
    </div>
  );
}

function CourseEditDialog({ course, onClose, onChanged }: { course: Courses[number]; onClose: () => void; onChanged: () => void }) {
  const [code, setCode] = useState(course.code);
  const [name, setName] = useState(course.name);
  const [credits, setCredits] = useState(String(course.credits));
  const [semester, setSemester] = useState(course.semester ? String(course.semester) : "all");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const res = await updateProgramCourse(course.id, {
      code, name, credits: Number(credits) || 0,
      semester: semester === "all" ? null : Number(semester),
    });
    setBusy(false);
    if (res.success) { toast.success("Course updated for this programme"); onChanged(); onClose(); }
    else toast.error(res.error, { duration: 6000 });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {course.code} — this programme only</DialogTitle>
          <DialogDescription>
            These fields belong to this programme&apos;s copy. Changing them here never affects the Course
            Master{course.courseMaster ? " or the same course in any other programme" : ""}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground">Course code</label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} className="h-9" title="Unique within this programme" />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground">Credits</label>
            <Input type="number" min={0} max={40} step={0.5} value={credits} onChange={(e) => setCredits(e.target.value)} className="h-9" title="Credits for this course in this programme" />
          </div>
          <div className="space-y-1 col-span-2">
            <label className="text-[11px] font-semibold text-muted-foreground">Course name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1 col-span-2">
            <label className="text-[11px] font-semibold text-muted-foreground">Semester</label>
            <Select value={semester} onValueChange={(v) => setSemester(v || "all")}>
              <SelectTrigger className="h-9 text-xs" title="Offer this course only in one semester, or across all"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All semesters</SelectItem>
                {Array.from({ length: 12 }, (_, i) => <SelectItem key={i + 1} value={String(i + 1)}>Semester {i + 1}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button className="w-full" disabled={busy} onClick={save}>
          {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save changes
        </Button>
      </DialogContent>
    </Dialog>
  );
}
