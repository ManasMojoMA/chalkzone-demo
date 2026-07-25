"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  getUsers, updateUserRole, toggleUserStatus,
  createUser, updateUserDetails, deleteUser,
  importStudentsCsv,
} from "./actions";
import { listDesignationRules, listBatches, listPrograms } from "@/app/dashboard/timetable/actions";
import { parseCsv, toCsv, downloadCsv } from "@/lib/csv";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/password-input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Pencil, Trash2, UserPlus, Search, ArrowUpDown, Upload, Download, FileSpreadsheet, CheckCircle2, XCircle } from "lucide-react";
import type { Role } from "@prisma/client";

const ROLES = ["STUDENT", "FACULTY", "HR", "MANAGER", "ADMIN", "SUPER_ADMIN", "PARENT", "EXECUTIVE"] as const;

type UserRow = Awaited<ReturnType<typeof getUsers>>[number];
type SortKey = "name" | "role" | "recent";

export default function AdminUsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters / sort
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [sortBy, setSortBy] = useState<SortKey>("recent");

  // Shared config lookups (loaded when a dialog opens)
  const [designations, setDesignations] = useState<{ designation: string; maxWeeklyHours: number }[]>([]);
  const [batches, setBatches] = useState<Awaited<ReturnType<typeof listBatches>>>([]);

  // Add-user dialog
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", email: "", mobile: "", password: "", role: "STUDENT" as (typeof ROLES)[number],
    rollNo: "", programId: "", batchId: "", employeeCode: "", department: "", designation: "",
  });
  const [csvOpen, setCsvOpen] = useState(false);
  const [programs, setPrograms] = useState<Awaited<ReturnType<typeof listPrograms>>>([]);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  // Edit-user dialog
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "", rollNo: "", program: "", currentSemester: "", mobile: "",
    employeeCode: "", department: "", designation: "",
  });

  useEffect(() => {
    if (user && ["ADMIN", "SUPER_ADMIN"].includes(user.role)) loadData();
  }, [user]);

  const loadConfigLookups = () => {
    listDesignationRules().then((r) => {
      const tagged = r.rules.map(({ designation, maxWeeklyHours }) => ({ designation, maxWeeklyHours }));
      const untagged = r.knownDesignations
        .filter((d) => !r.rules.some((x) => x.designation === d))
        .map((d) => ({ designation: d, maxWeeklyHours: 16 }));
      setDesignations([...tagged, ...untagged]);
    }).catch(() => {});
    listBatches().then(setBatches).catch(() => {});
    listPrograms().then(setPrograms).catch(() => {});
  };
  useEffect(() => { if (addOpen || editUser) loadConfigLookups(); }, [addOpen, editUser]);

  const loadData = async () => {
    setLoading(true);
    try {
      setUsers(await getUsers());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, role: Role) => {
    try {
      await updateUserRole(userId, role);
      toast.success("Role updated");
      loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update role");
    }
  };

  const handleToggleStatus = async (userId: string, currentStatus: boolean) => {
    const res = await toggleUserStatus(userId, !currentStatus).catch((e) => ({ success: false as const, error: e?.message }));
    if (res.success) { toast.success(`User ${!currentStatus ? "activated" : "deactivated"}`); loadData(); }
    else toast.error(res.error ?? "Failed to update status");
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      const res = await createUser(form);
      if (res.success) {
        toast.success(`Account created for ${form.email}`);
        setAddOpen(false);
        setForm({ name: "", email: "", mobile: "", password: "", role: "STUDENT", rollNo: "", programId: "", batchId: "", employeeCode: "", department: "", designation: "" });
        loadData();
      } else toast.error(res.error);
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (u: UserRow) => {
    setEditUser(u);
    setEditForm({
      name: u.name ?? "",
      rollNo: u.studentProfile?.rollNo ?? "",
      program: u.studentProfile?.program ?? "",
      currentSemester: u.studentProfile?.currentSemester ? String(u.studentProfile.currentSemester) : "",
      mobile: u.mobile ?? u.studentProfile?.mobile ?? u.facultyProfile?.mobile ?? "",
      employeeCode: u.facultyProfile?.employeeCode ?? "",
      department: u.facultyProfile?.department ?? "",
      designation: u.facultyProfile?.designation ?? "",
    });
  };

  const handleEditSave = async () => {
    if (!editUser) return;
    setEditSaving(true);
    try {
      const res = await updateUserDetails(editUser.id, {
        name: editForm.name,
        rollNo: editForm.rollNo,
        mobile: editForm.mobile,
        employeeCode: editForm.employeeCode,
        department: editForm.department,
        designation: editForm.designation,
      });
      if (res.success) { toast.success("Changes saved"); setEditUser(null); loadData(); }
      else toast.error(res.error);
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async (u: UserRow) => {
    if (!confirm(`Permanently delete ${u.email}? This removes their login too. Users with activity history can only be deactivated.`)) return;
    const res = await deleteUser(u.id);
    if (res.success) { toast.success("User deleted"); loadData(); }
    else toast.error(res.error);
  };

  const filtered = useMemo(() => {
    let rows = users;
    const q = search.trim().toLowerCase();
    if (q) rows = rows.filter((u) =>
      (u.name ?? "").toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.studentProfile?.rollNo ?? "").toLowerCase().includes(q) ||
      (u.facultyProfile?.employeeCode ?? "").toLowerCase().includes(q)
    );
    if (roleFilter !== "ALL") rows = rows.filter((u) => u.role === roleFilter);
    if (statusFilter !== "ALL") rows = rows.filter((u) => (statusFilter === "ACTIVE" ? u.isActive : !u.isActive));

    const sorted = [...rows];
    if (sortBy === "name") sorted.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
    else if (sortBy === "role") sorted.sort((a, b) => a.role.localeCompare(b.role) || (a.name ?? "").localeCompare(b.name ?? ""));
    // "recent" keeps getUsers()'s createdAt-desc order
    return sorted;
  }, [users, search, roleFilter, statusFilter, sortBy]);

  if (loading) {
    return <div className="flex h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!user || !["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
    return <div className="p-8 text-center text-muted-foreground">Access denied. Admin privileges required.</div>;
  }

  const isSuper = user.role === "SUPER_ADMIN";

  /** Role-specific summary shown in the "Details" column. */
  const detailsOf = (u: UserRow) => {
    if (u.role === "STUDENT" && u.studentProfile) {
      const p = u.studentProfile;
      return [p.rollNo, p.program, p.currentSemester ? `Sem ${p.currentSemester}` : null, p.section ? `Sec ${p.section}` : null]
        .filter(Boolean).join(" · ") || "—";
    }
    if (u.role === "FACULTY" && u.facultyProfile) {
      const f = u.facultyProfile;
      return [f.employeeCode, f.department, f.designation].filter(Boolean).join(" · ") || "—";
    }
    return "—";
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tighter uppercase">User Management</h1>
          <p className="text-muted-foreground mt-1">Provision accounts and manage roles. Batch & section placement lives in Program Management.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCsvOpen(true)} title="Create many student accounts at once from a CSV file">
            <Upload className="h-4 w-4 mr-1.5" /> Bulk onboard (CSV)
          </Button>
          <Button onClick={() => setAddOpen(true)}>
            <UserPlus className="h-4 w-4 mr-1.5" /> Add User
          </Button>
        </div>
      </div>

      {/* Filters & sort */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, roll no, employee code…" className="pl-8 h-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v || "ALL")}>
          <SelectTrigger className="h-9 w-[150px]" title="Filter by role"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All roles</SelectItem>
            {ROLES.map((r) => <SelectItem key={r} value={r}>{r.replace("_", " ")}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter((v as typeof statusFilter) || "ALL")}>
          <SelectTrigger className="h-9 w-[130px]" title="Filter by status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="ACTIVE">Active only</SelectItem>
            <SelectItem value="INACTIVE">Inactive only</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => setSortBy((v as SortKey) || "recent")}>
          <SelectTrigger className="h-9 w-[150px]" title="Sort order">
            <ArrowUpDown className="h-3.5 w-3.5 mr-1" /><SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Newest first</SelectItem>
            <SelectItem value="name">Name (A–Z)</SelectItem>
            <SelectItem value="role">Role</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-muted-foreground -mt-3">{filtered.length} of {users.length} users</p>

      <div className="border rounded-md shadow-sm overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Details</TableHead>
              <TableHead>Change Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((u) => (
              <TableRow key={u.id} className={!u.isActive ? "opacity-60" : undefined}>
                <TableCell className="font-medium">{u.name || "N/A"}</TableCell>
                <TableCell className="text-sm">{u.email}</TableCell>
                <TableCell><Badge variant="outline">{u.role.replace("_", " ")}</Badge></TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[220px] truncate" title={detailsOf(u)}>{detailsOf(u)}</TableCell>
                <TableCell>
                  <Select defaultValue={u.role} onValueChange={(val) => val && handleRoleChange(u.id, val as Role)}>
                    <SelectTrigger className="w-[136px] h-8" title="Change this user's role"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLES.filter((r) => isSuper || r !== "SUPER_ADMIN").map((role) => (
                        <SelectItem key={role} value={role}>{role.replace("_", " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <div className="flex items-center space-x-2">
                    <Switch checked={u.isActive} onCheckedChange={() => handleToggleStatus(u.id, u.isActive)} disabled={u.id === user.id} title={u.id === user.id ? "You can't deactivate yourself" : "Toggle active status"} />
                    <span className="text-xs text-muted-foreground">{u.isActive ? "Active" : "Inactive"}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="inline-flex items-center gap-2">
                    <button type="button" title="Edit details" className="text-muted-foreground hover:text-foreground" onClick={() => openEdit(u)}>
                      <Pencil className="h-4 w-4" />
                    </button>
                    {isSuper && u.id !== user.id && u.role !== "SUPER_ADMIN" && (
                      <button type="button" title="Delete user permanently" className="text-destructive" onClick={() => handleDelete(u)}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">No users match these filters.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Add-user dialog ── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add a new user</DialogTitle>
            <DialogDescription>Creates the login account (email pre-verified) and the role profile in one go.</DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); handleCreate(); }}>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="nu-name">Full name</Label>
                <Input id="nu-name" value={form.name} onChange={set("name")} required placeholder="Priya Sharma" title="The person's full name" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="nu-email">Email</Label>
                <Input id="nu-email" type="email" value={form.email} onChange={set("email")} required placeholder="name@university.edu" title="Their login email - this becomes their username and can't be changed later" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="nu-mobile">Mobile number</Label>
                <Input id="nu-mobile" type="tel" value={form.mobile} onChange={set("mobile")} required placeholder="98XXXXXXXX" title="Their contact number — required for every account" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nu-pass">Temporary password</Label>
                <PasswordInput id="nu-pass" value={form.password} onChange={set("password")} required placeholder="min 8 characters" title="An initial password — the user can change it later from Settings" />
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={form.role} onValueChange={(v) => v && setForm((f) => ({ ...f, role: v as (typeof ROLES)[number] }))}>
                  <SelectTrigger className="w-full" title="What this account can do in the system"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.filter((r) => isSuper || r !== "SUPER_ADMIN").map((r) => (
                      <SelectItem key={r} value={r}>{r.replace("_", " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {form.role === "STUDENT" && (
                <>
                  <div className="space-y-1.5 col-span-2">
                    <Label htmlFor="nu-roll">Roll number</Label>
                    <Input id="nu-roll" value={form.rollNo} onChange={set("rollNo")} required placeholder="CS2026-042" title="The student's unique roll/enrolment number" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="nu-prog">Programme</Label>
                    <Select value={form.programId} onValueChange={(v) => setForm((f) => ({ ...f, programId: v || "", batchId: "" }))}>
                      <SelectTrigger id="nu-prog" title="The programme this student joins — from Configuration → Programmes"><SelectValue placeholder="Pick programme" /></SelectTrigger>
                      <SelectContent>
                        {programs.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        {programs.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">No programmes — create them in Configuration</div>}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="nu-batch">Batch</Label>
                    <Select value={form.batchId} onValueChange={(v) => setForm((f) => ({ ...f, batchId: v || "" }))}>
                      <SelectTrigger id="nu-batch" title="The admission batch within the chosen programme — from Configuration → Batches"><SelectValue placeholder={form.programId ? "Pick batch" : "Pick programme first"} /></SelectTrigger>
                      <SelectContent>
                        {batches.filter((b) => b.programId === form.programId).map((b) => <SelectItem key={b.id} value={b.id}>{b.label}</SelectItem>)}
                        {form.programId && batches.filter((b) => b.programId === form.programId).length === 0 && (
                          <div className="px-2 py-1.5 text-xs text-muted-foreground">No batches for this programme — create one in Configuration</div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-[10px] text-muted-foreground col-span-2 -mt-1">
                    Semester &amp; course sections are assigned later in <b>Program Management</b>.
                  </p>
                </>
              )}
              {form.role === "FACULTY" && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="nu-emp">Employee code</Label>
                    <Input id="nu-emp" value={form.employeeCode} onChange={set("employeeCode")} required placeholder="FAC-042" title="The faculty member's unique employee code" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="nu-dept">Department</Label>
                    <Input id="nu-dept" value={form.department} onChange={set("department")} placeholder="CSE" title="The department they belong to" />
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <Label htmlFor="nu-desig">Designation</Label>
                    {designations.length > 0 ? (
                      <Select value={form.designation} onValueChange={(v) => setForm((f) => ({ ...f, designation: v || "" }))}>
                        <SelectTrigger id="nu-desig" title="Their designation — sets the weekly teaching-hour cap"><SelectValue placeholder="Pick designation" /></SelectTrigger>
                        <SelectContent>
                          {designations.map((d) => (
                            <SelectItem key={d.designation} value={d.designation}>{d.designation} · {d.maxWeeklyHours}h/week cap</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input id="nu-desig" value={form.designation} onChange={set("designation")} placeholder="Assistant Professor" />
                    )}
                    <p className="text-[10px] text-muted-foreground">
                      Manage designation tags & their hour caps in Configuration → Faculty Designations.
                    </p>
                  </div>
                </>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create account
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Edit-user dialog ── */}
      <Dialog open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit {editUser?.role.replace("_", " ").toLowerCase()} details</DialogTitle>
            <DialogDescription>
              Email &amp; role are managed from the table. {editUser?.role === "STUDENT" ? "Assign this student to a section here." : "Update profile fields here."}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); handleEditSave(); }}>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="eu-name">Full name</Label>
                <Input id="eu-name" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} required />
              </div>

              {editUser?.role === "STUDENT" && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="eu-roll">Roll number</Label>
                    <Input id="eu-roll" value={editForm.rollNo} onChange={(e) => setEditForm((f) => ({ ...f, rollNo: e.target.value }))} title="The student's roll/enrolment number" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="eu-mobile">Mobile</Label>
                    <Input id="eu-mobile" value={editForm.mobile} onChange={(e) => setEditForm((f) => ({ ...f, mobile: e.target.value }))} title="Contact number" />
                  </div>
                  <p className="text-[10px] text-muted-foreground col-span-2">
                    Batch &amp; section placement is managed in{" "}
                    <a href="/dashboard/programs" className="text-primary font-semibold underline">Program Management</a> — this dialog only edits the student&apos;s identity details.
                  </p>
                </>
              )}

              {editUser?.role === "FACULTY" && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="eu-emp">Employee code</Label>
                    <Input id="eu-emp" value={editForm.employeeCode} onChange={(e) => setEditForm((f) => ({ ...f, employeeCode: e.target.value }))} title="Unique employee code" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="eu-dept">Department</Label>
                    <Input id="eu-dept" value={editForm.department} onChange={(e) => setEditForm((f) => ({ ...f, department: e.target.value }))} title="Department" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="eu-mobile-f">Mobile</Label>
                    <Input id="eu-mobile-f" value={editForm.mobile} onChange={(e) => setEditForm((f) => ({ ...f, mobile: e.target.value }))} title="Contact number" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="eu-desig">Designation</Label>
                    {designations.length > 0 ? (
                      <Select value={editForm.designation} onValueChange={(v) => setEditForm((f) => ({ ...f, designation: v || "" }))}>
                        <SelectTrigger id="eu-desig" title="Sets the weekly teaching-hour cap"><SelectValue placeholder="Pick" /></SelectTrigger>
                        <SelectContent>
                          {designations.map((d) => <SelectItem key={d.designation} value={d.designation}>{d.designation} · {d.maxWeeklyHours}h</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input id="eu-desig" value={editForm.designation} onChange={(e) => setEditForm((f) => ({ ...f, designation: e.target.value }))} />
                    )}
                  </div>
                </>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={editSaving}>
                {editSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save changes
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      {csvOpen && <BulkOnboardDialog onClose={() => setCsvOpen(false)} onChanged={loadData} />}
    </div>
  );
}


// ─── Bulk onboard students via CSV ──────────────────────────────────────────

function BulkOnboardDialog({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Record<string, string>[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: number; failed: { row: number; rollNo: string; reason: string }[] } | null>(null);

  const template = () => {
    downloadCsv("chalkzone-onboard-students-template.csv", toCsv(
      ["rollNo", "name", "email", "mobile", "programme", "batch", "password"],
      [
        ["BBA2026-001", "Aarav Sharma", "aarav.sharma@university.edu", "9990001111", "BBA", "2026-2029", ""],
        ["BBA2026-002", "Diya Verma", "diya.verma@university.edu", "9990002222", "BBA", "2026-2029", ""],
      ]
    ));
  };

  const onFile = async (file: File) => {
    setFileName(file.name);
    const text = await file.text();
    const parsed = parseCsv(text);
    if (parsed.length === 0) { toast.error("Couldn't read any data rows — check the file has a header row and at least one student."); return; }
    setRows(parsed);
    setResult(null);
  };

  const run = async () => {
    if (!rows) return;
    setBusy(true);
    const mapped = rows.map((r) => ({
      rollNo: r.rollno ?? r["roll no"] ?? r.roll ?? "",
      name: r.name ?? "",
      email: r.email ?? "",
      mobile: r.mobile ?? r.phone ?? "",
      programme: r.programme ?? r.program ?? "",
      batch: r.batch ?? "",
      password: r.password ?? "",
    }));
    const res = await importStudentsCsv(mapped);
    setBusy(false);
    if (res.error) { toast.error(res.error); return; }
    setResult({ ok: res.ok, failed: res.failed });
    if (res.ok > 0) onChanged();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Bulk onboard students</DialogTitle>
          <DialogDescription>
            Creates login accounts AND places each student in their programme &amp; batch, straight from a
            spreadsheet. Programme and batch names must match Configuration exactly.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs space-y-2">
              <p className="font-semibold inline-flex items-center gap-1.5"><FileSpreadsheet className="h-4 w-4 text-primary" /> Step 1 — get the template</p>
              <p className="text-muted-foreground">
                Columns: <b>rollNo, name, email, mobile, programme, batch</b> (all required), <b>password</b>{" "}
                (optional — blank means <code className="bg-muted px-1 rounded">Password123!</code>).
              </p>
              <Button size="sm" variant="outline" onClick={template}><Download className="h-4 w-4 mr-1.5" /> Download template</Button>
            </div>
            <div className="rounded-lg border p-3 text-xs space-y-2">
              <p className="font-semibold">Step 2 — upload your filled file</p>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) onFile(file); }} />
              <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4 mr-1.5" /> Choose CSV file</Button>
              {fileName && <p className="text-muted-foreground">Loaded <b>{fileName}</b> — {rows?.length ?? 0} row(s) ready.</p>}
            </div>
            {rows && rows.length > 0 && (
              <div className="max-h-36 overflow-auto border rounded-lg text-xs">
                <table className="w-full">
                  <thead className="bg-muted/50 sticky top-0"><tr><th className="text-left px-2 py-1">Roll</th><th className="text-left px-2 py-1">Name</th><th className="text-left px-2 py-1">Programme</th><th className="text-left px-2 py-1">Batch</th></tr></thead>
                  <tbody>
                    {rows.slice(0, 15).map((r, i) => (
                      <tr key={i} className="border-t"><td className="px-2 py-1">{r.rollno ?? r.roll ?? ""}</td><td className="px-2 py-1">{r.name}</td><td className="px-2 py-1">{r.programme ?? r.program ?? ""}</td><td className="px-2 py-1">{r.batch}</td></tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 15 && <p className="text-[10px] text-muted-foreground px-2 py-1">…and {rows.length - 15} more</p>}
              </div>
            )}
            <Button className="w-full" disabled={busy || !rows || rows.length === 0} onClick={run}>
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Onboard {rows?.length ?? 0} student(s)
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span><b>{result.ok}</b> student(s) onboarded successfully.</span>
            </div>
            {result.failed.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                  <XCircle className="h-5 w-5" /> <b>{result.failed.length}</b> row(s) skipped:
                </div>
                <div className="max-h-40 overflow-auto border rounded-lg text-xs divide-y">
                  {result.failed.map((fl, i) => (
                    <div key={i} className="px-2.5 py-1.5 flex justify-between gap-2">
                      <span>Row {fl.row} <span className="text-muted-foreground">{fl.rollNo}</span></span>
                      <span className="text-destructive text-right">{fl.reason}</span>
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
