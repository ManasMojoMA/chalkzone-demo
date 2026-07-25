"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  getStudentAttendance, getMyAttendanceDetail,
  getTeachableCourses, listSessions, getSessionRoster, saveSession, deleteSession,
} from "./actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, BookOpen, CalendarPlus, ChevronLeft, Users, Trash2, CheckCircle2 } from "lucide-react";
import { PERIOD_TIMES } from "@/app/dashboard/timetable/timetable-grid";
import { toast } from "sonner";

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function AttendancePage() {
  const { user } = useAuth();
  if (!user) return null;
  const isStaff = ["FACULTY", "ADMIN", "SUPER_ADMIN"].includes(user.role);

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-black tracking-tighter uppercase">Attendance</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {isStaff ? "Take attendance session by session for the courses you teach." : "Your attendance, class by class."}
        </p>
      </div>
      {isStaff ? <StaffAttendance /> : <StudentAttendance />}
    </div>
  );
}

// ─── Student ─────────────────────────────────────────────────────────────────

function StudentAttendance() {
  const [records, setRecords] = useState<Awaited<ReturnType<typeof getStudentAttendance>> | null>(null);
  const [openSubject, setOpenSubject] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => { getStudentAttendance().then(setRecords).catch(() => setRecords([])); }, []);

  if (!records) return <Center><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></Center>;
  if (records.length === 0) {
    return (
      <Card><CardContent className="py-14 text-center text-sm text-muted-foreground">
        <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
        No attendance recorded yet. Once your faculty marks a class, it appears here.
      </CardContent></Card>
    );
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {records.map((r) => {
          const pct = Math.round(r.percentage);
          const safe = r.percentage >= 75, warn = r.percentage >= 65 && r.percentage < 75;
          const need = Math.max(0, Math.ceil((0.75 * r.totalClasses - r.attendedClasses) / 0.25));
          return (
            <Card key={r.id} className={`overflow-hidden border-l-4 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md ${safe ? "border-l-green-500" : warn ? "border-l-amber-500" : "border-l-red-500"}`}
              onClick={() => setOpenSubject({ id: r.subjectId, name: r.subject.name })}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <CardTitle className="text-base font-bold truncate">{r.subject.name}</CardTitle>
                    <CardDescription className="text-xs">{r.subject.code} · Sem {r.semester}</CardDescription>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`font-black text-3xl tracking-tight leading-none ${safe ? "text-green-600 dark:text-green-400" : warn ? "text-amber-600 dark:text-amber-400" : "text-red-500"}`}>{pct}%</div>
                    <span className={`text-[10px] font-bold uppercase ${safe ? "text-green-600/70" : warn ? "text-amber-600/80" : "text-red-500/80"}`}>{safe ? "On track" : warn ? "Close to 75%" : "Below 75%"}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-2 space-y-3">
                <Progress value={r.percentage} className={`w-full [&_[data-slot=progress-track]]:h-2.5 ${safe ? "[&_[data-slot=progress-indicator]]:bg-green-500" : warn ? "[&_[data-slot=progress-indicator]]:bg-amber-500" : "[&_[data-slot=progress-indicator]]:bg-red-500"}`} />
                <div className="flex justify-between text-xs font-medium text-muted-foreground">
                  <span>Attended <b className="text-foreground">{r.attendedClasses}</b> of {r.totalClasses}</span>
                  {!safe && need > 0 && <span className="text-red-500/90">{need} more to reach 75%</span>}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      {openSubject && <StudentDetailDialog subject={openSubject} onClose={() => setOpenSubject(null)} />}
    </>
  );
}

function StudentDetailDialog({ subject, onClose }: { subject: { id: string; name: string }; onClose: () => void }) {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof getMyAttendanceDetail>> | null>(null);
  useEffect(() => { getMyAttendanceDetail(subject.id).then(setRows).catch(() => setRows([])); }, [subject.id]);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle className="text-base">{subject.name} — attendance log</DialogTitle>
          <DialogDescription>Every class marked so far.</DialogDescription></DialogHeader>
        {!rows ? <Center><Loader2 className="h-6 w-6 animate-spin text-primary" /></Center> : (
          <div className="max-h-80 overflow-y-auto border rounded-lg divide-y">
            {rows.map((r, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                <span>{new Date(r.date).toLocaleDateString()} <span className="text-muted-foreground text-xs">· P{r.period}{r.topic ? ` · ${r.topic}` : ""}</span></span>
                <StatusPill status={r.status} />
              </div>
            ))}
            {rows.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">No classes marked yet.</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Staff ───────────────────────────────────────────────────────────────────

function StaffAttendance() {
  const [courses, setCourses] = useState<Awaited<ReturnType<typeof getTeachableCourses>> | null>(null);
  const [active, setActive] = useState<Awaited<ReturnType<typeof getTeachableCourses>>[number] | null>(null);

  useEffect(() => { getTeachableCourses().then(setCourses).catch(() => setCourses([])); }, []);

  if (!courses) return <Center><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></Center>;
  if (active) return <CourseAttendance course={active} onBack={() => setActive(null)} />;

  if (courses.length === 0) {
    return (
      <Card><CardContent className="py-14 text-center text-sm text-muted-foreground">
        You have no course-sections assigned yet. Assign courses to faculty in <b>Timetable → step 2</b>, and enroll students in <b>Program Management</b>.
      </CardContent></Card>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {courses.map((c) => (
        <Card key={c.assignmentId} className="cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md" onClick={() => setActive(c)}>
          <CardContent className="p-4 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold">{c.subjectCode}</span>
              <Badge variant="outline" className="text-[9px]">{c.sessionCount} sessions</Badge>
            </div>
            <p className="text-sm">{c.subjectName}</p>
            <p className="text-xs text-muted-foreground">{c.sectionLabel}</p>
            <p className="text-[11px] text-primary font-semibold inline-flex items-center gap-1"><Users className="h-3 w-3" /> {c.enrolled} students · Take attendance →</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function CourseAttendance({ course, onBack }: { course: Awaited<ReturnType<typeof getTeachableCourses>>[number]; onBack: () => void }) {
  const [sessions, setSessions] = useState<Awaited<ReturnType<typeof listSessions>> | null>(null);
  const [marking, setMarking] = useState<{ dateISO: string; period: number } | null>(null);

  const load = useCallback(() => { listSessions(course.assignmentId).then(setSessions); }, [course.assignmentId]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ChevronLeft className="h-3.5 w-3.5" /> All my courses
      </button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">{course.subjectCode} — {course.subjectName}</h2>
          <p className="text-xs text-muted-foreground">{course.sectionLabel} · {course.enrolled} students</p>
        </div>
        <Button size="sm" onClick={() => setMarking({ dateISO: todayISO(), period: 1 })}>
          <CalendarPlus className="h-4 w-4 mr-1.5" /> New session
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead className="text-xs">Date</TableHead>
              <TableHead className="text-xs">Period</TableHead>
              <TableHead className="text-xs">Topic</TableHead>
              <TableHead className="text-xs text-right">Present</TableHead>
              <TableHead className="w-10" />
            </TableRow></TableHeader>
            <TableBody>
              {(sessions ?? []).map((s) => (
                <TableRow key={s.id} className="cursor-pointer" onClick={() => setMarking({ dateISO: new Date(s.date).toISOString().slice(0, 10), period: s.period })}>
                  <TableCell className="text-xs font-medium">{new Date(s.date).toLocaleDateString()}</TableCell>
                  <TableCell className="text-xs">P{s.period}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{s.topic ?? "—"}</TableCell>
                  <TableCell className="text-xs text-right">{s.present}/{s.total}</TableCell>
                  <TableCell>
                    <button type="button" title="Delete session" className="text-destructive" onClick={async (e) => {
                      e.stopPropagation();
                      if (!confirm("Delete this session and its attendance?")) return;
                      const res = await deleteSession(s.id);
                      if (res.success) { toast.success("Session deleted"); load(); } else toast.error(res.error);
                    }}><Trash2 className="h-3.5 w-3.5" /></button>
                  </TableCell>
                </TableRow>
              ))}
              {sessions && sessions.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-8">No sessions yet — click “New session”.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {marking && (
        <MarkDialog assignmentId={course.assignmentId} init={marking} onClose={() => setMarking(null)} onSaved={() => { load(); }} />
      )}
    </div>
  );
}

function MarkDialog({ assignmentId, init, onClose, onSaved }: {
  assignmentId: string; init: { dateISO: string; period: number }; onClose: () => void; onSaved: () => void;
}) {
  const [dateISO, setDateISO] = useState(init.dateISO);
  const [period, setPeriod] = useState(init.period);
  const [topic, setTopic] = useState("");
  const [students, setStudents] = useState<{ studentProfileId: string; name: string; rollNo: string | null; status: string }[] | null>(null);
  const [busy, setBusy] = useState(false);

  const loadRoster = useCallback(() => {
    setStudents(null);
    getSessionRoster(assignmentId, dateISO, period).then((r) => setStudents(r.students)).catch(() => setStudents([]));
  }, [assignmentId, dateISO, period]);
  useEffect(() => { loadRoster(); }, [loadRoster]);

  const setStatus = (id: string, status: string) => setStudents((prev) => prev && prev.map((s) => s.studentProfileId === id ? { ...s, status } : s));
  const allPresent = () => setStudents((prev) => prev && prev.map((s) => ({ ...s, status: "PRESENT" })));

  const save = async () => {
    if (!students || students.length === 0) return toast.error("No students enrolled to mark.");
    setBusy(true);
    const res = await saveSession({ assignmentId, dateISO, period, topic, marks: students.map((s) => ({ studentProfileId: s.studentProfileId, status: s.status })) });
    setBusy(false);
    if (res.success) { toast.success("Attendance saved"); onSaved(); onClose(); } else toast.error(res.error);
  };

  const presentCount = students?.filter((s) => s.status !== "ABSENT").length ?? 0;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">Mark attendance</DialogTitle>
          <DialogDescription>Pick the date & period, then tap a student to flip present/absent.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground">Date</label>
              <Input type="date" value={dateISO} max={todayISO()} onChange={(e) => setDateISO(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground">Period</label>
              <select value={period} onChange={(e) => setPeriod(Number(e.target.value))} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
                {PERIOD_TIMES.map((t, i) => <option key={i} value={i + 1}>P{i + 1} · {t}</option>)}
              </select>
            </div>
          </div>
          <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Topic (optional)" className="h-9" />

          {!students ? <Center><Loader2 className="h-6 w-6 animate-spin text-primary" /></Center> : students.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">No students enrolled in this section for this course. Enroll them in Program Management.</p>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold">{presentCount}/{students.length} present</span>
                <button type="button" onClick={allPresent} className="text-primary font-semibold hover:underline">Mark all present</button>
              </div>
              <div className="max-h-64 overflow-y-auto border rounded-lg divide-y">
                {students.map((s) => (
                  <div key={s.studentProfileId} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span><b>{s.rollNo ?? "—"}</b> {s.name}</span>
                    <div className="flex gap-1">
                      {["PRESENT", "LATE", "ABSENT"].map((st) => (
                        <button key={st} type="button" onClick={() => setStatus(s.studentProfileId, st)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${s.status === st
                            ? st === "PRESENT" ? "bg-green-500 text-white border-green-500" : st === "LATE" ? "bg-amber-500 text-white border-amber-500" : "bg-red-500 text-white border-red-500"
                            : "text-muted-foreground border-border hover:bg-muted"}`}>
                          {st === "PRESENT" ? "P" : st === "LATE" ? "L" : "A"}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <Button className="w-full" disabled={busy} onClick={save}>
                {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />} Save attendance
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── shared ──────────────────────────────────────────────────────────────────

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex h-[300px] items-center justify-center">{children}</div>;
}
function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    PRESENT: "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400",
    LATE: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
    ABSENT: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400",
  };
  return <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${map[status] ?? map.PRESENT}`}>{status}</span>;
}
