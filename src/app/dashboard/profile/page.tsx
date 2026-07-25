"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { getMyProfile } from "./actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Loader2, UserRound, GraduationCap, Briefcase, Building2 } from "lucide-react";

type Profile = Awaited<ReturnType<typeof getMyProfile>>;

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/70 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium mt-0.5">{value ?? <span className="text-muted-foreground">—</span>}</p>
    </div>
  );
}

export default function ProfilePage() {
  const { user } = useAuth();
  const [data, setData] = useState<Profile | null>(null);

  useEffect(() => {
    if (user) getMyProfile().then(setData).catch(() => {});
  }, [user]);

  if (!user) return null;
  if (!data) {
    return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const initials = (data.user.name || "?").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      {/* Identity card */}
      <Card className="border-2 border-slate-900 shadow-[5px_5px_0px_0px_rgba(15,23,42,1)] dark:border-border">
        <CardContent className="flex items-center gap-4 pt-6">
          <Avatar className="h-16 w-16 border-2 border-slate-900 dark:border-border">
            <AvatarFallback className="bg-primary/10 text-primary text-xl font-black">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h1 className="text-2xl font-black tracking-tight truncate">{data.user.name}</h1>
            <p className="text-sm text-muted-foreground truncate">{data.user.email}{data.user.mobile ? ` · ${data.user.mobile}` : ""}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <Badge className="bg-primary text-white">{data.user.role.replace("_", " ")}</Badge>
              <Badge variant="outline">{data.user.isActive ? "Active" : "Inactive"}</Badge>
              <span className="text-[11px] text-muted-foreground">
                Member since {new Date(data.user.memberSince).toLocaleDateString()}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Role-specific demographics */}
      {data.student && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base inline-flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-primary" /> Academic Profile
            </CardTitle>
            <CardDescription>Your enrolment details as registered with the university.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
            <Field label="Roll Number" value={data.student.rollNo} />
            <Field label="Programme" value={data.student.program} />
            <Field label="Section" value={data.student.section} />
            <Field label="Current Semester" value={data.student.currentSemester} />
            <Field label="Admission Year" value={data.student.admissionYear} />
            <Field label="CGPA" value={data.student.cgpa?.toFixed(2)} />
            <Field label="Status" value={data.student.status} />
          </CardContent>
        </Card>
      )}

      {data.faculty && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base inline-flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-primary" /> Faculty Profile
            </CardTitle>
            <CardDescription>Your employment details as registered with the university.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
            <Field label="Employee Code" value={data.faculty.employeeCode} />
            <Field label="Department" value={data.faculty.department} />
            <Field label="Designation" value={data.faculty.designation} />
          </CardContent>
        </Card>
      )}

      {data.hr && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base inline-flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" /> Recruiter Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
            <Field label="Company" value={data.hr.company?.name} />
            <Field label="Designation" value={data.hr.designation} />
          </CardContent>
        </Card>
      )}

      {!data.student && !data.faculty && !data.hr && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            <UserRound className="h-8 w-8 mx-auto mb-2 opacity-40" />
            No extended profile is attached to this account — contact the admin office if that looks wrong.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
