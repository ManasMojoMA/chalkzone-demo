"use client";

import { useState } from "react";
import { listCourseMaster, saveCourseMaster, deleteCourseMaster, listSectionLabels, saveSectionLabel, deleteSectionLabel } from "./actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export type CourseMasterList = Awaited<ReturnType<typeof listCourseMaster>>;
export type SectionLabelList = Awaited<ReturnType<typeof listSectionLabels>>;

// ─── Course Master ───────────────────────────────────────────────────────────

export function CourseMasterPanel({ courses, onChanged }: { courses: CourseMasterList; onChanged: () => void }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [credits, setCredits] = useState("4");
  const [editingId, setEditingId] = useState<string | null>(null);

  const reset = () => { setEditingId(null); setCode(""); setName(""); setCredits("4"); };

  const save = async () => {
    const res = await saveCourseMaster({ id: editingId ?? undefined, code, name, credits: Number(credits) || 0 });
    if (res.success) { toast.success(editingId ? "Course updated" : "Course added to master catalogue"); reset(); onChanged(); }
    else toast.error(res.error);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Course Master</CardTitle>
        <CardDescription>
          The global course catalogue — author each course once here. Import it into any programme from
          that programme&apos;s page in <b>Program Management → Courses</b>; each import is that programme&apos;s
          own copy, so editing or removing it there never affects the master or other programmes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-[1fr_2fr_auto] gap-2 items-end">
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground">Course code</label>
            <Input placeholder="MKT101" value={code} onChange={(e) => setCode(e.target.value)} className="h-9" title="A short unique code, e.g. MKT101" onKeyDown={(e) => e.key === "Enter" && save()} />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground">Course name</label>
            <Input placeholder="Marketing Management" value={name} onChange={(e) => setName(e.target.value)} className="h-9" title="The full course title" onKeyDown={(e) => e.key === "Enter" && save()} />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground">Credits</label>
            <Input type="number" min={0} max={40} step={0.5} value={credits} onChange={(e) => setCredits(e.target.value)} className="h-9 w-20" title="Credit weight" />
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={save} className="flex-1"><Plus className="h-4 w-4 mr-1" /> {editingId ? "Update Course" : "Add Course"}</Button>
          {editingId && <Button size="sm" variant="outline" onClick={reset}>Cancel</Button>}
        </div>
        <div className="space-y-1.5 max-h-72 overflow-y-auto">
          {courses.map((c) => (
            <div key={c.id} className={`flex items-center justify-between rounded-md border px-3 py-2 text-xs ${editingId === c.id ? "border-primary bg-primary/5" : ""}`}>
              <span className="min-w-0">
                <span className="font-semibold">{c.code} — {c.name}</span>{" "}
                <span className="text-muted-foreground">· {c.credits} cr{c._count.copies > 0 && ` · imported into ${c._count.copies} programme${c._count.copies > 1 ? "s" : ""}`}</span>
              </span>
              <span className="flex items-center gap-2 shrink-0 ml-2">
                <button type="button" title={`Edit ${c.code}`} className="text-muted-foreground hover:text-foreground" onClick={() => { setEditingId(c.id); setCode(c.code); setName(c.name); setCredits(String(c.credits)); }}><Pencil className="h-4 w-4" /></button>
                <button type="button" title={`Delete ${c.code}`} className="text-destructive" onClick={async () => {
                  if (!confirm(`Delete ${c.code} from the master catalogue?`)) return;
                  const res = await deleteCourseMaster(c.id);
                  if (res.success) { toast.success("Deleted"); onChanged(); } else toast.error(res.error, { duration: 7000 });
                }}><Trash2 className="h-4 w-4" /></button>
              </span>
            </div>
          ))}
          {courses.length === 0 && <p className="text-xs text-muted-foreground">No courses yet — add the first one above.</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Section Labels ──────────────────────────────────────────────────────────

export function SectionLabelsPanel({ labels, onChanged }: { labels: SectionLabelList; onChanged: () => void }) {
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const reset = () => { setEditingId(null); setName(""); };

  const save = async () => {
    const res = await saveSectionLabel({ id: editingId ?? undefined, name });
    if (res.success) { toast.success(editingId ? "Label updated" : "Label created"); reset(); onChanged(); }
    else toast.error(res.error);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Section Labels</CardTitle>
        <CardDescription>
          Reusable section names — e.g. A, B, C, Elective-AI. Map a label into a concrete section for a
          batch &amp; semester in <b>Program Management → batch → Sections &amp; Courses</b>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input placeholder="e.g. A, B, Elective-AI" value={name} onChange={(e) => setName(e.target.value)} className="h-9" title="A short reusable section name" onKeyDown={(e) => e.key === "Enter" && save()} />
          <Button size="sm" onClick={save}>{editingId ? "Save" : <Plus className="h-4 w-4" />}</Button>
          {editingId && <Button size="sm" variant="outline" onClick={reset}>Cancel</Button>}
        </div>
        <div className="space-y-1.5">
          {labels.map((l) => (
            <div key={l.id} className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${editingId === l.id ? "border-primary bg-primary/5" : ""}`}>
              <span className="font-medium">{l.name} {l._count.sections > 0 && <span className="text-muted-foreground text-xs">· used in {l._count.sections} section{l._count.sections > 1 ? "s" : ""}</span>}</span>
              <span className="flex items-center gap-2">
                <button type="button" title={`Edit ${l.name}`} className="text-muted-foreground hover:text-foreground" onClick={() => { setEditingId(l.id); setName(l.name); }}><Pencil className="h-4 w-4" /></button>
                <button type="button" title={`Delete ${l.name}`} className="text-destructive" onClick={async () => {
                  if (!confirm(`Delete section label "${l.name}"?`)) return;
                  const res = await deleteSectionLabel(l.id);
                  if (res.success) { toast.success("Deleted"); onChanged(); } else toast.error(res.error, { duration: 6000 });
                }}><Trash2 className="h-4 w-4" /></button>
              </span>
            </div>
          ))}
          {labels.length === 0 && <p className="text-xs text-muted-foreground">No section labels yet — add the first one above.</p>}
        </div>
      </CardContent>
    </Card>
  );
}
