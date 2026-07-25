"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { TicketStatus, TicketPriority } from "@prisma/client";
import type { TicketWithRelations } from "@/lib/types";
import {
  fetchStudentTickets,
  fetchAllTickets,
  fetchCategories,
  createTicket,
  updateTicketStatus,
  seedMockTickets,
} from "./actions";
import { TicketListView, TicketKanbanView } from "./ticket-views";
import { TicketDetailSheet } from "./ticket-detail-sheet";
import { TicketSettingsDialog } from "./ticket-settings-dialog";
import { PRIORITY_META } from "@/lib/ticket-meta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { ViewToggle, type ViewMode } from "@/components/view-toggle";

const VIEW_KEY = "cz-tickets-view";
const STAFF_ROLES = ["FACULTY", "HR", "MANAGER", "ADMIN", "SUPER_ADMIN"];

export default function TicketsPage() {
  const { user } = useAuth();
  const isStaffUser = !!user && STAFF_ROLES.includes(user.role);

  const [tickets, setTickets] = useState<TicketWithRelations[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("list");
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [openTicketId, setOpenTicketId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Raise-ticket dialog
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ title: "", description: "", categoryId: "", priority: "MEDIUM" as TicketPriority });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(VIEW_KEY) as ViewMode | null;
    if (stored === "list" || stored === "kanban") setView(stored);
    else if (user && STAFF_ROLES.includes(user.role)) setView("kanban");
  }, [user]);

  const changeView = (v: ViewMode) => {
    setView(v);
    localStorage.setItem(VIEW_KEY, v);
  };

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [t, c] = await Promise.all([
        isStaffUser ? fetchAllTickets(scope) : fetchStudentTickets(),
        fetchCategories(),
      ]);
      setTickets(t as TicketWithRelations[]);
      setCategories(c);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load tickets");
    } finally {
      setLoading(false);
    }
  }, [user, isStaffUser, scope]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = async () => {
    if (!formData.title || !formData.description || !formData.categoryId) {
      toast.error("Please fill in all fields");
      return;
    }
    setCreating(true);
    try {
      const res = await createTicket(formData);
      if (res.success) {
        toast.success("Ticket raised");
        setIsDialogOpen(false);
        setFormData({ title: "", description: "", categoryId: "", priority: "MEDIUM" });
        loadData();
      } else {
        toast.error(res.error);
      }
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (ticketId: string, status: TicketStatus) => {
    setTickets((prev) => prev.map((t) => (t.id === ticketId ? { ...t, status } : t)));
    try {
      await updateTicketStatus(ticketId, status);
    } catch {
      toast.error("Failed to update status");
    }
    loadData();
  };

  if (!user) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tighter uppercase">
            {isStaffUser ? "Support Tickets" : "My Tickets"}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {isStaffUser
              ? "Triage, discuss and resolve requests. Drag cards in Kanban to change status."
              : "Raise and track your support requests."}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {isStaffUser && (user.role === "ADMIN" || user.role === "SUPER_ADMIN") && (
            <div className="inline-flex items-center rounded-lg border overflow-hidden text-xs font-semibold">
              {(["mine", "all"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScope(s)}
                  className={s === scope ? "bg-foreground text-background px-2.5 py-1.5" : "px-2.5 py-1.5 hover:bg-muted"}
                  title={s === "mine" ? "Tickets assigned to you, unassigned, or where you're tagged" : "Every ticket in the system (admin oversight)"}
                >
                  {s === "mine" ? "My queue" : "All tickets"}
                </button>
              ))}
            </div>
          )}
          {isStaffUser && user.role === "SUPER_ADMIN" && (
            <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
              <Settings2 className="h-4 w-4 mr-1.5" /> SLA Settings
            </Button>
          )}
          {process.env.NODE_ENV === "development" && (
            <Button variant="outline" size="sm" onClick={async () => { await seedMockTickets(); loadData(); }}>
              Seed
            </Button>
          )}
          {/* Only students raise tickets; staff resolve them */}
          {!isStaffUser && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger render={<Button size="sm" />}>
              <Plus className="h-4 w-4 mr-1.5" /> Raise Ticket
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Raise a Ticket</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Brief description of the issue"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={formData.categoryId} onValueChange={(v) => setFormData({ ...formData, categoryId: v || "" })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: (v as TicketPriority) || "MEDIUM" })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Priority" />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(PRIORITY_META) as TicketPriority[]).map((p) => (
                          <SelectItem key={p} value={p}>{PRIORITY_META[p].label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Provide details…"
                    className="min-h-[100px]"
                  />
                </div>
                <Button onClick={handleCreate} disabled={creating} className="w-full">
                  {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Submit Ticket
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          )}

          <ViewToggle view={view} onChange={changeView} />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : view === "list" ? (
        <TicketListView tickets={tickets} onOpen={(t) => setOpenTicketId(t.id)} />
      ) : (
        <TicketKanbanView
          tickets={tickets}
          draggable={isStaffUser}
          onOpen={(t) => setOpenTicketId(t.id)}
          onStatusChange={handleStatusChange}
        />
      )}

      <TicketDetailSheet
        ticketId={openTicketId}
        isStaffUser={isStaffUser}
        currentUserId={user.id}
        currentUserRole={user.role}
        onClose={() => setOpenTicketId(null)}
        onChanged={loadData}
      />

      {(user.role === "ADMIN" || user.role === "SUPER_ADMIN") && (
        <TicketSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      )}
    </div>
  );
}
