"use client";

import { useEffect, useState } from "react";
import { getPermissionMatrix, setPermission } from "@/app/dashboard/admin/permissions/actions";
import { APP_SECTIONS, MANAGED_ROLES, type PermissionLevel, type SectionKey } from "@/lib/permissions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const LEVEL_META: Record<PermissionLevel, { label: string; cls: string }> = {
  EDIT: { label: "Full", cls: "text-green-700 dark:text-green-400" },
  VIEW: { label: "View only", cls: "text-amber-600 dark:text-amber-400" },
  NONE: { label: "Hidden", cls: "text-red-500" },
};

/** Role × section permission matrix. Every cell saves immediately. */
export function AccessPanel() {
  const [matrix, setMatrix] = useState<Record<string, Record<string, PermissionLevel>> | null>(null);

  const load = () => getPermissionMatrix().then(setMatrix).catch(() => toast.error("Failed to load permissions"));
  useEffect(() => { load(); }, []);

  const change = async (role: string, section: SectionKey, level: PermissionLevel) => {
    // optimistic update
    setMatrix((m) => (m ? { ...m, [role]: { ...m[role], [section]: level } } : m));
    const res = await setPermission(role, section, level);
    if (res.success) toast.success(`${role.replace("_", " ")} → ${APP_SECTIONS.find((s) => s.key === section)?.label}: ${LEVEL_META[level].label}`);
    else { toast.error(res.error); load(); }
  };

  if (!matrix) return <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Access Control</CardTitle>
        <CardDescription>
          What each role can do in each section. <b>Full</b> = see and change everything (the default) ·{" "}
          <b>View only</b> = can open the section but every save/change is rejected · <b>Hidden</b> = the
          section disappears from their menu and direct links are blocked. Changes apply on the user&apos;s next
          page load. Master admins are never restricted.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs sticky left-0 bg-card">Section</TableHead>
              {MANAGED_ROLES.map((r) => (
                <TableHead key={r} className="text-xs text-center whitespace-nowrap">{r.replace("_", " ")}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {APP_SECTIONS.map((s) => (
              <TableRow key={s.key}>
                <TableCell className="text-xs font-semibold sticky left-0 bg-card whitespace-nowrap">{s.label}</TableCell>
                {MANAGED_ROLES.map((role) => {
                  const level = matrix[role]?.[s.key] ?? "EDIT";
                  return (
                    <TableCell key={role} className="text-center p-1.5">
                      <Select value={level} onValueChange={(v) => v && change(role, s.key, v as PermissionLevel)}>
                        <SelectTrigger
                          className={cn("h-7 w-[104px] text-[11px] font-semibold mx-auto", LEVEL_META[level].cls)}
                          title={`${role.replace("_", " ")} access to ${s.label}`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(LEVEL_META) as PermissionLevel[]).map((l) => (
                            <SelectItem key={l} value={l}>{LEVEL_META[l].label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
