"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  listPrograms, listDesignationRules, listClassrooms,
} from "@/app/dashboard/timetable/actions";
import {
  ProgramsPanel, RulesPanel, RoomsPanel, BatchesPanel,
  type Programs, type Rules, type Rooms,
} from "@/app/dashboard/timetable/timetable-setup";
import { listCourseMaster, listSectionLabels } from "./actions";
import { CourseMasterPanel, SectionLabelsPanel, type CourseMasterList, type SectionLabelList } from "./catalogue-panels";
import { AccessPanel } from "./access-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Wrench, BookOpen, GraduationCap, DoorOpen, Landmark, CalendarRange, LayoutGrid, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

/**
 * Configuration hub — pure catalogues, created once and reused everywhere.
 * Operational work (mapping a course into a programme, creating a real
 * section, enrolling students, building the timetable) lives in
 * Program Management, which reads these catalogues as dropdown sources.
 */
export default function ConfigurationPage() {
  const { user } = useAuth();
  const [programs, setPrograms] = useState<Programs>([]);
  const [courseMaster, setCourseMaster] = useState<CourseMasterList>([]);
  const [sectionLabels, setSectionLabels] = useState<SectionLabelList>([]);
  const [rules, setRules] = useState<Rules | null>(null);
  const [rooms, setRooms] = useState<Rooms>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  const load = useCallback(async () => {
    try {
      const [p, cm, sl, r, c] = await Promise.all([
        listPrograms(), listCourseMaster(), listSectionLabels(), listDesignationRules(), listClassrooms(),
      ]);
      setPrograms(p); setCourseMaster(cm); setSectionLabels(sl); setRules(r); setRooms(c);
    } catch {
      toast.error("Failed to load configuration data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);

  if (!user) return null;
  if (!isAdmin) {
    return <div className="p-8 text-center text-muted-foreground">Access denied. Admin privileges required.</div>;
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-black tracking-tighter uppercase inline-flex items-center gap-2">
          <Wrench className="h-7 w-7 text-primary" /> Configuration
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Reusable catalogues, created once — every value here is then offered as a dropdown wherever it
          applies (onboarding, Program Management, timetable placement). Day-to-day mapping and enrollment
          happen in <b>Program Management</b>.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <Tabs defaultValue="programmes">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="programmes"><Landmark className="h-4 w-4 mr-1.5" /> Programmes</TabsTrigger>
            <TabsTrigger value="batches"><CalendarRange className="h-4 w-4 mr-1.5" /> Batches</TabsTrigger>
            <TabsTrigger value="coursemaster"><BookOpen className="h-4 w-4 mr-1.5" /> Course Master</TabsTrigger>
            <TabsTrigger value="labels"><LayoutGrid className="h-4 w-4 mr-1.5" /> Section Labels</TabsTrigger>
            <TabsTrigger value="faculty"><GraduationCap className="h-4 w-4 mr-1.5" /> Faculty Designations & Hour Caps</TabsTrigger>
            <TabsTrigger value="rooms"><DoorOpen className="h-4 w-4 mr-1.5" /> Classrooms</TabsTrigger>
            {user.role === "SUPER_ADMIN" && (
              <TabsTrigger value="access"><ShieldCheck className="h-4 w-4 mr-1.5" /> Access Control</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="programmes" className="pt-4 max-w-3xl space-y-3">
            <p className="text-xs text-muted-foreground">
              Programmes anchor everything: batches, courses and sections all belong to one. Manage batches,
              courses and sections for a programme in <b>Program Management</b>.
            </p>
            <ProgramsPanel programs={programs} onChanged={load} />
          </TabsContent>

          <TabsContent value="batches" className="pt-4 max-w-3xl">
            <BatchesPanel programs={programs} onChanged={load} />
          </TabsContent>

          <TabsContent value="coursemaster" className="pt-4 max-w-3xl">
            <CourseMasterPanel courses={courseMaster} onChanged={load} />
          </TabsContent>

          <TabsContent value="labels" className="pt-4 max-w-2xl">
            <SectionLabelsPanel labels={sectionLabels} onChanged={load} />
          </TabsContent>

          <TabsContent value="faculty" className="pt-4 max-w-3xl space-y-3">
            <p className="text-xs text-muted-foreground">
              These designation tags drive two things: they&apos;re offered when onboarding a faculty member in
              User Management, and their weekly-hour caps are enforced live when placing timetable classes.
            </p>
            <RulesPanel rules={rules} onChanged={load} />
          </TabsContent>

          <TabsContent value="rooms" className="pt-4 max-w-3xl space-y-3">
            <p className="text-xs text-muted-foreground">
              Configured rooms appear in the timetable placement dialog. The system blocks allotting the same
              room to two classes at the same time on the same day, with a message naming the clash.
            </p>
            <RoomsPanel rooms={rooms} onChanged={load} />
          </TabsContent>

          {user.role === "SUPER_ADMIN" && (
            <TabsContent value="access" className="pt-4">
              <AccessPanel />
            </TabsContent>
          )}
        </Tabs>
      )}
    </div>
  );
}
