"use client";

import { useAuth } from "@/lib/auth-context";
import { useCallback, useEffect, useState } from "react";
import { getStudentPerformance, getGradableCourses, getMarksRoster, saveStudentMarks } from "./actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Loader2, ChevronLeft, Users, GraduationCap, Save } from "lucide-react";
import { toast } from "sonner";

export default function PerformancePage() {
  const { user } = useAuth();
  if (!user) return null;
  const isStaff = ["FACULTY", "ADMIN", "SUPER_ADMIN"].includes(user.role);

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-black tracking-tighter uppercase">
          {isStaff ? "Manage Marks" : "Performance Scorecard"}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {isStaff
            ? "Enter marks for the students enrolled in your course-sections."
            : "Your marks, grades and credit-weighted CGPA."}
        </p>
      </div>
      {isStaff ? <StaffMarks /> : <StudentPerformance />}
    </div>
  );
}

// ─── Student ─────────────────────────────────────────────────────────────────

function StudentPerformance() {
  const [data, setData] = useState<Awaited<ReturnType<typeof getStudentPerformance>> | null | undefined>(undefined);
  useEffect(() => { getStudentPerformance().then(setData).catch(() => setData(null)); }, []);

  if (data === undefined) return <Center><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></Center>;
  if (!data || data.marks.length === 0) {
    return (
      <Card><CardContent className="py-14 text-center text-sm text-muted-foreground">
        <GraduationCap className="h-8 w-8 mx-auto mb-2 opacity-50" />
        No marks yet — they appear here once your faculty publishes them.
      </CardContent></Card>
    );
  }

  const { cgpa, marks } = data;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Cumulative GPA</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{cgpa?.toFixed(2) || "0.00"}</div>
            <Progress value={(cgpa || 0) * 10} className="mt-3 [&_[data-slot=progress-track]]:h-2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Graded Courses</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{marks.length}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Course-wise marks</CardTitle>
          <CardDescription>Internal + external + practical, out of 100.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course</TableHead>
                  <TableHead>Sem</TableHead>
                  <TableHead className="text-right">Internal</TableHead>
                  <TableHead className="text-right">External</TableHead>
                  <TableHead className="text-right">Practical</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Grade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {marks.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.subject.code} <span className="text-muted-foreground font-normal">{m.subject.name}</span></TableCell>
                    <TableCell>{m.semester}</TableCell>
                    <TableCell className="text-right">{m.internalMarks}</TableCell>
                    <TableCell className="text-right">{m.externalMarks}</TableCell>
                    <TableCell className="text-right">{m.practicalMarks}</TableCell>
                    <TableCell className="text-right font-bold">{m.totalMarks}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={m.grade === "F" ? "destructive" : "default"} className={m.grade === "O" || m.grade === "A+" ? "bg-green-500 hover:bg-green-600" : ""}>
                        {m.grade}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Staff: pick a course-section, grade its enrolled students ──────────────

function StaffMarks() {
  const [courses, setCourses] = useState<Awaited<ReturnType<typeof getGradableCourses>> | null>(null);
  const [active, setActive] = useState<Awaited<ReturnType<typeof getGradableCourses>>[number] | null>(null);

  useEffect(() => { getGradableCourses().then(setCourses).catch(() => setCourses([])); }, []);

  if (!courses) return <Center><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></Center>;
  if (active) return <MarksSheet course={active} onBack={() => setActive(null)} />;

  if (courses.length === 0) {
    return (
      <Card><CardContent className="py-14 text-center text-sm text-muted-foreground">
        No course-sections assigned to you yet. Courses are attached to sections (with faculty) in{" "}
        <b>Program Management → batch → Sections &amp; Courses</b>.
      </CardContent></Card>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {courses.map((c) => (
        <Card key={c.assignmentId} className="cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md" onClick={() => setActive(c)}>
          <CardContent className="p-4 space-y-1.5">
            <span className="font-bold">{c.subjectCode}</span>
            <p className="text-sm">{c.subjectName}</p>
            <p className="text-xs text-muted-foreground">{c.sectionLabel}</p>
            <p className="text-[11px] text-primary font-semibold inline-flex items-center gap-1">
              <Users className="h-3 w-3" /> {c.enrolled} students · Enter marks →
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function MarksSheet({ course, onBack }: { course: Awaited<ReturnType<typeof getGradableCourses>>[number]; onBack: () => void }) {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof getMarksRoster>>["students"] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    getMarksRoster(course.assignmentId).then((r) => setRows(r.students)).catch(() => setRows([]));
  }, [course.assignmentId]);
  useEffect(() => { load(); }, [load]);

  const edit = (id: string, field: "internalMarks" | "externalMarks" | "practicalMarks", value: number) =>
    setRows((prev) => prev && prev.map((r) => (r.studentProfileId === id ? { ...r, [field]: value } : r)));

  const save = async (r: NonNullable<typeof rows>[number]) => {
    setBusyId(r.studentProfileId);
    const res = await saveStudentMarks(course.assignmentId, r.studentProfileId, r.internalMarks, r.externalMarks, r.practicalMarks);
    setBusyId(null);
    if (res.success) { toast.success(`Saved — ${res.totalMarks}/100, grade ${res.grade}`); load(); }
    else toast.error(res.error);
  };

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ChevronLeft className="h-3.5 w-3.5" /> All my courses
      </button>
      <div>
        <h2 className="text-lg font-bold">{course.subjectCode} — {course.subjectName}</h2>
        <p className="text-xs text-muted-foreground">{course.sectionLabel}</p>
      </div>

      {!rows ? (
        <Center><Loader2 className="h-6 w-6 animate-spin text-primary" /></Center>
      ) : rows.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
          No students enrolled in this course-section yet — enroll them in Program Management.
        </CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Roll No</TableHead>
                  <TableHead className="text-xs">Name</TableHead>
                  <TableHead className="text-xs text-right">Internal</TableHead>
                  <TableHead className="text-xs text-right">External</TableHead>
                  <TableHead className="text-xs text-right">Practical</TableHead>
                  <TableHead className="text-xs text-right">Total</TableHead>
                  <TableHead className="text-xs text-right">Grade</TableHead>
                  <TableHead className="w-14" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const total = r.internalMarks + r.externalMarks + r.practicalMarks;
                  return (
                    <TableRow key={r.studentProfileId}>
                      <TableCell className="text-xs font-medium">{r.rollNo ?? "—"}</TableCell>
                      <TableCell className="text-xs">{r.name}</TableCell>
                      {(["internalMarks", "externalMarks", "practicalMarks"] as const).map((f) => (
                        <TableCell key={f} className="text-right">
                          <Input
                            type="number" min={0} max={100}
                            value={r[f]}
                            onChange={(e) => edit(r.studentProfileId, f, Number(e.target.value) || 0)}
                            className="h-8 w-16 text-right text-xs ml-auto"
                            title={f === "internalMarks" ? "Internal assessment marks" : f === "externalMarks" ? "External exam marks" : "Practical marks"}
                          />
                        </TableCell>
                      ))}
                      <TableCell className={`text-xs text-right font-bold ${total > 100 ? "text-red-500" : ""}`}>{total}</TableCell>
                      <TableCell className="text-xs text-right">{r.grade ? <Badge variant={r.grade === "F" ? "destructive" : "default"}>{r.grade}</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" className="h-7 px-2" disabled={busyId === r.studentProfileId || total > 100} onClick={() => save(r)} title="Save this student's marks">
                          {busyId === r.studentProfileId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex h-[300px] items-center justify-center">{children}</div>;
}
