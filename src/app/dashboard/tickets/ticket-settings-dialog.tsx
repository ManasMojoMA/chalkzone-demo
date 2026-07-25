"use client";

import { useEffect, useState } from "react";
import type { CategoryWithSla } from "@/lib/types";
import { fetchCategoriesWithSla, updateCategorySla, setCategoryOwners, getStaffUsers } from "./actions";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, Timer } from "lucide-react";
import { toast } from "sonner";

type StaffUser = { id: string; name: string | null; email: string; role: string };

const ESCALATION_ROLES = ["MANAGER", "ADMIN", "SUPER_ADMIN", "HR", "FACULTY"] as const;
const NONE = "__none__";

function CategoryRow({ category, staff, onSaved }: { category: CategoryWithSla; staff: StaffUser[]; onSaved: () => void }) {
  const [slaHours, setSlaHours] = useState(String(category.slaHours));
  const [escRole, setEscRole] = useState(category.escalationRole ?? NONE);
  const [escUser, setEscUser] = useState(category.escalationUserId ?? NONE);
  const [owners, setOwners] = useState<string[]>(category.staffOwners.map((o) => o.userId));
  const [saving, setSaving] = useState(false);

  const toggleOwner = (id: string, on: boolean) => {
    setOwners((prev) => (on ? [...new Set([...prev, id])] : prev.filter((x) => x !== id)));
  };

  const save = async () => {
    setSaving(true);
    try {
      const slaRes = await updateCategorySla(category.id, {
        slaHours: Number(slaHours),
        escalationRole: escRole === NONE ? null : escRole,
        escalationUserId: escUser === NONE ? null : escUser,
      });
      if (!slaRes.success) {
        toast.error(slaRes.error);
        return;
      }
      const ownRes = await setCategoryOwners(category.id, owners);
      if (!ownRes.success) {
        toast.error(ownRes.error);
        return;
      }
      toast.success(`${category.name} settings saved`);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold">{category.name}</h3>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
          Save
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">SLA (hours)</Label>
          <Input type="number" min={1} max={720} value={slaHours} onChange={(e) => setSlaHours(e.target.value)} className="h-9" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Escalate to role</Label>
          <Select value={escRole} onValueChange={(v) => setEscRole((v as typeof escRole) || NONE)}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>None</SelectItem>
              {ESCALATION_ROLES.map((r) => (
                <SelectItem key={r} value={r}>{r.replace("_", " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Or a specific person</Label>
          <Select value={escUser} onValueChange={(v) => setEscUser(v || NONE)}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>None</SelectItem>
              {staff.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name} — {s.role}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Category owners (shown first when reassigning tickets in this category)</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {staff.map((s) => (
            <label key={s.id} className="flex items-center gap-2 text-xs rounded-md border px-2 py-1.5 cursor-pointer hover:bg-muted/40">
              <Checkbox checked={owners.includes(s.id)} onCheckedChange={(c) => toggleOwner(s.id, !!c)} />
              <span className="truncate">{s.name} <span className="text-muted-foreground">({s.role})</span></span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TicketSettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [categories, setCategories] = useState<CategoryWithSla[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [cats, staffUsers] = await Promise.all([fetchCategoriesWithSla(), getStaffUsers()]);
      setCategories(cats as CategoryWithSla[]);
      setStaff(staffUsers);
    } catch {
      toast.error("Failed to load ticket settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load();
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="inline-flex items-center gap-2">
            <Timer className="h-5 w-5 text-primary" /> SLA & Escalation Settings
          </DialogTitle>
          <DialogDescription>
            Per category: how long before an unresolved ticket escalates, who it escalates to, and which staff own the category.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            {categories.map((c) => (
              <CategoryRow key={c.id} category={c} staff={staff} onSaved={load} />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
