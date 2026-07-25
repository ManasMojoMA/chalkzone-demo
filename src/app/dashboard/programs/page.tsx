"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { listProgramsOverview } from "./actions";
import { Card, CardContent } from "@/components/ui/card";
import { GraduationCap, Loader2, Users, Layers, BookOpen, ArrowRight, Wrench } from "lucide-react";

type Row = Awaited<ReturnType<typeof listProgramsOverview>>[number];

export default function ProgramManagementPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);

  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  useEffect(() => { if (isAdmin) listProgramsOverview().then(setRows).catch(() => setRows([])); }, [isAdmin]);

  if (!user) return null;
  if (!isAdmin) return <div className="p-8 text-center text-muted-foreground">Access denied. Admin privileges required.</div>;

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-black tracking-tighter uppercase inline-flex items-center gap-2">
          <GraduationCap className="h-7 w-7 text-primary" /> Program Management
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Place students into batches and course sections. Pick a programme to begin.
        </p>
      </div>

      {rows === null ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center text-sm text-muted-foreground space-y-2">
            <p>No programmes yet.</p>
            <p className="inline-flex items-center gap-1.5">
              <Wrench className="h-4 w-4" /> Create them in{" "}
              <Link href="/dashboard/admin/config" className="text-primary font-semibold underline">Configuration → Programmes</Link>.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((p) => (
            <Link key={p.id} href={`/dashboard/programs/${p.id}`} className="group">
              <Card className="h-full transition-all group-hover:-translate-y-0.5 group-hover:shadow-md">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <h2 className="font-bold text-base leading-tight truncate">{p.name}</h2>
                      {p.code && <p className="text-xs text-muted-foreground">{p.code}{p.department ? ` · ${p.department}` : ""}</p>}
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0" />
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Layers className="h-3.5 w-3.5" /> {p.batchCount} batch{p.batchCount === 1 ? "" : "es"}</span>
                    <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {p.studentCount} students</span>
                    <span className="inline-flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" /> {p.courseCount} courses</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
