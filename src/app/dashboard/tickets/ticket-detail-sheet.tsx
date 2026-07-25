"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TicketStatus, TicketPriority } from "@prisma/client";
import type { TicketDetail } from "@/lib/types";
import {
  getTicketDetail,
  addTicketMessage,
  updateTicketStatus,
  updateTicketPriority,
  addInternalNote,
  getStaffUsers,
  addParticipant,
  removeParticipant,
  getReassignmentCandidates,
  reassignTicket,
  uploadTicketAttachment,
  getAttachmentUrl,
} from "./actions";
import { STATUS_META, STATUS_ORDER, PRIORITY_META, isTicketEscalated, slaCountdown } from "@/lib/ticket-meta";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  AlarmClock,
  Loader2,
  Lock,
  Paperclip,
  Send,
  ShieldAlert,
  UserMinus,
  UserPlus,
  Users,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { EscalatedBadge } from "./ticket-views";

type StaffUser = { id: string; name: string | null; email: string; role: string };

function initials(name: string | null | undefined) {
  return (name || "?").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

function AttachmentChip({ attachment }: { attachment: { id: string; filename: string; sizeBytes: number } }) {
  const [busy, setBusy] = useState(false);
  const open = async () => {
    setBusy(true);
    try {
      const res = await getAttachmentUrl(attachment.id);
      if (res.success) window.open(res.url, "_blank");
      else toast.error(res.error);
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      type="button"
      onClick={open}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-1 text-xs hover:bg-muted transition-colors max-w-full"
      title={`Download ${attachment.filename}`}
    >
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
      <span className="truncate max-w-[160px]">{attachment.filename}</span>
      <span className="text-muted-foreground">({Math.max(1, Math.round(attachment.sizeBytes / 1024))} KB)</span>
    </button>
  );
}

function FileUploadButton({
  ticketId,
  internalNoteId,
  onUploaded,
  label = "Attach",
}: {
  ticketId: string;
  internalNoteId?: string | null;
  onUploaded: () => void;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File exceeds the 10MB limit");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("ticketId", ticketId);
      if (internalNoteId) fd.append("internalNoteId", internalNoteId);
      fd.append("file", file);
      const res = await uploadTicketAttachment(fd);
      if (res.success) {
        toast.success("Attachment uploaded");
        onUploaded();
      } else {
        toast.error(res.error);
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <input ref={inputRef} type="file" className="hidden" onChange={onPick} aria-label="Choose file to attach" />
      <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
        {uploading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Paperclip className="h-4 w-4 mr-1.5" />}
        {label}
      </Button>
    </>
  );
}

export function TicketDetailSheet({
  ticketId,
  isStaffUser,
  currentUserId,
  currentUserRole,
  onClose,
  onChanged,
}: {
  ticketId: string | null;
  isStaffUser: boolean;
  currentUserId: string;
  currentUserRole: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const [reply, setReply] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  const [note, setNote] = useState("");
  const [sendingNote, setSendingNote] = useState(false);

  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [candidates, setCandidates] = useState<(StaffUser & { ownsCategory: boolean })[]>([]);
  const [participantPick, setParticipantPick] = useState("");
  const [assigneePick, setAssigneePick] = useState("");

  const load = useCallback(async (silent = false) => {
    if (!ticketId) return;
    // Silent refreshes keep the tree mounted so the active tab and scroll
    // position survive (a full spinner swap would reset Tabs to default)
    if (!silent) setLoading(true);
    try {
      const d = await getTicketDetail(ticketId);
      setDetail(d as TicketDetail | null);
      if (isStaffUser && d) {
        const [staff, cands] = await Promise.all([getStaffUsers(), getReassignmentCandidates(ticketId)]);
        setStaffUsers(staff);
        setCandidates(cands as (StaffUser & { ownsCategory: boolean })[]);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [ticketId, isStaffUser]);

  useEffect(() => {
    setDetail(null);
    setReply("");
    setNote("");
    setParticipantPick("");
    setAssigneePick("");
    if (ticketId) load();
  }, [ticketId, load]);

  const refresh = () => {
    load(true);
    onChanged();
  };

  const sendReply = async () => {
    if (!detail || !reply.trim()) return;
    setSendingReply(true);
    try {
      const res = await addTicketMessage(detail.id, reply);
      if (res.success) {
        setReply("");
        refresh();
      } else toast.error(res.error);
    } finally {
      setSendingReply(false);
    }
  };

  const sendNote = async () => {
    if (!detail || !note.trim()) return;
    setSendingNote(true);
    try {
      const res = await addInternalNote(detail.id, { content: note });
      if (res.success) {
        setNote("");
        refresh();
      } else toast.error(res.error);
    } finally {
      setSendingNote(false);
    }
  };

  const changeStatus = async (status: TicketStatus) => {
    if (!detail) return;
    await updateTicketStatus(detail.id, status);
    toast.success(`Status → ${STATUS_META[status].label}`);
    refresh();
  };

  const changePriority = async (priority: TicketPriority) => {
    if (!detail) return;
    const res = await updateTicketPriority(detail.id, priority);
    if (res.success) {
      toast.success(`Priority → ${PRIORITY_META[priority].label}`);
      refresh();
    } else toast.error(res.error);
  };

  const tagParticipant = async () => {
    if (!detail || !participantPick) return;
    const res = await addParticipant(detail.id, participantPick);
    if (res.success) {
      toast.success("SPOC tagged into this ticket");
      setParticipantPick("");
      refresh();
    } else toast.error(res.error);
  };

  const untagParticipant = async (userId: string) => {
    if (!detail) return;
    const res = await removeParticipant(detail.id, userId);
    if (res.success) {
      toast.success("Participant removed");
      refresh();
    } else toast.error(res.error);
  };

  const doReassign = async () => {
    if (!detail || !assigneePick) return;
    const handedOff = assigneePick !== currentUserId;
    const res = await reassignTicket(detail.id, assigneePick);
    if (res.success) {
      toast.success("Ticket reassigned");
      setAssigneePick("");
      onChanged();
      // Handed to someone else → it's left your queue, so close the sheet.
      // (Kept open only if you assigned it to yourself.)
      if (handedOff) onClose();
      else refresh();
    } else toast.error(res.error);
  };

  const canRemoveParticipants =
    !!detail && (detail.assigneeId === currentUserId || currentUserRole === "ADMIN" || currentUserRole === "SUPER_ADMIN");

  const escalated = detail ? isTicketEscalated(detail) : false;
  const mainAttachments = detail?.attachments.filter((a) => a.internalNoteId === null) ?? [];
  const availableToTag = staffUsers.filter(
    (s) => s.id !== currentUserId && !detail?.participants.some((p) => p.userId === s.id)
  );

  return (
    <Sheet open={!!ticketId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full data-[side=right]:sm:max-w-2xl overflow-y-auto p-0">
        {loading || !detail ? (
          <div className="flex h-full items-center justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="flex flex-col">
            {/* Header */}
            <SheetHeader className="p-5 pb-3 border-b bg-muted/30">
              <div className="flex items-start justify-between gap-3 pr-8">
                <SheetTitle className="text-xl leading-tight">{detail.title}</SheetTitle>
                {escalated && <EscalatedBadge />}
              </div>
              <SheetDescription className="sr-only">Ticket details</SheetDescription>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="outline" className={cn("border", STATUS_META[detail.status].badge)}>
                  <span className={cn("mr-1.5 inline-block h-2 w-2 rounded-full", STATUS_META[detail.status].dot)} />
                  {STATUS_META[detail.status].label}
                </Badge>
                <Badge variant="outline" className={cn("border", PRIORITY_META[detail.priority].badge)}>
                  {PRIORITY_META[detail.priority].label}
                </Badge>
                <Badge variant="outline">{detail.category?.name}</Badge>
                {detail.slaDeadline && detail.status !== "RESOLVED" && detail.status !== "CLOSED" && (
                  <span className={cn("inline-flex items-center gap-1 font-medium", escalated ? "text-red-600" : "text-muted-foreground")}>
                    <AlarmClock className="h-3.5 w-3.5" />
                    SLA: {slaCountdown(detail.slaDeadline)}
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                Raised by <span className="font-medium text-foreground">{detail.creator?.name}</span> ·{" "}
                {new Date(detail.createdAt).toLocaleString()}
                {detail.assignee && (
                  <>
                    {" "}· Assigned to <span className="font-medium text-foreground">{detail.assignee.name}</span>
                  </>
                )}
              </div>

              {isStaffUser && (
                <div className="flex flex-wrap gap-2 pt-1 items-center">
                  <Select value={detail.status} onValueChange={(v) => v && changeStatus(v as TicketStatus)}>
                    <SelectTrigger className="h-8 w-[170px] text-xs">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_ORDER.map((s) => (
                        <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={detail.priority} onValueChange={(v) => v && changePriority(v as TicketPriority)}>
                    <SelectTrigger className="h-8 w-[120px] text-xs">
                      <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(PRIORITY_META) as TicketPriority[]).map((p) => (
                        <SelectItem key={p} value={p}>{PRIORITY_META[p].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-1.5">
                    <Select value={assigneePick} onValueChange={(v) => setAssigneePick(v || "")}>
                      <SelectTrigger className="h-8 w-[210px] text-xs">
                        <SelectValue placeholder={detail.assignee ? `Reassign (now: ${detail.assignee.name})` : "Assign to…"} />
                      </SelectTrigger>
                      <SelectContent>
                        {candidates.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name} — {c.role}{c.ownsCategory ? " · owns category" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button size="sm" className="h-8" onClick={doReassign} disabled={!assigneePick}>
                      Assign
                    </Button>
                  </div>
                </div>
              )}
            </SheetHeader>

            {/* Body */}
            <div className="p-5 space-y-5">
              <div className="rounded-lg border bg-muted/20 p-4 text-sm whitespace-pre-wrap">{detail.description}</div>

              {mainAttachments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {mainAttachments.map((a) => (
                    <AttachmentChip key={a.id} attachment={a} />
                  ))}
                </div>
              )}

              <Tabs defaultValue="conversation">
                <TabsList className={cn("grid w-full", isStaffUser ? "grid-cols-2" : "grid-cols-1")}>
                  <TabsTrigger value="conversation">Conversation</TabsTrigger>
                  {isStaffUser && (
                    <TabsTrigger value="internal" className="gap-1.5">
                      <Lock className="h-3.5 w-3.5" />
                      Internal — staff only
                    </TabsTrigger>
                  )}
                </TabsList>

                {/* Public conversation */}
                <TabsContent value="conversation" className="space-y-4 pt-3">
                  <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                    {detail.messages.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-6">No replies yet.</p>
                    )}
                    {detail.messages.map((m) => (
                      <div key={m.id} className="flex gap-3">
                        <Avatar className="h-8 w-8 border shrink-0">
                          <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                            {m.isAi ? "AI" : initials(m.sender?.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="rounded-lg bg-muted/40 px-3 py-2 text-sm flex-1">
                          <div className="flex items-center justify-between gap-2 mb-0.5">
                            <span className="font-semibold text-xs">{m.isAi ? "AI Assistant" : m.sender?.name}</span>
                            <span className="text-[10px] text-muted-foreground">{new Date(m.createdAt).toLocaleString()}</span>
                          </div>
                          <p className="whitespace-pre-wrap">{m.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <Textarea
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      placeholder="Write a reply…"
                      rows={3}
                    />
                    <div className="flex items-center justify-between">
                      <FileUploadButton ticketId={detail.id} onUploaded={refresh} />
                      <Button size="sm" onClick={sendReply} disabled={sendingReply || !reply.trim()}>
                        {sendingReply ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Send className="h-4 w-4 mr-1.5" />}
                        Reply
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                {/* Internal staff panel */}
                {isStaffUser && (
                  <TabsContent value="internal" className="space-y-5 pt-3">
                    {/* Participants */}
                    <div className="space-y-2">
                      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground inline-flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" /> Tagged SPOCs
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {detail.participants.length === 0 && (
                          <span className="text-xs text-muted-foreground">No SPOCs tagged yet.</span>
                        )}
                        {detail.participants.map((p) => (
                          <Badge key={p.id} variant="secondary" className="gap-1.5 py-1">
                            {p.user.name}
                            <span className="text-[9px] text-muted-foreground">({p.user.role})</span>
                            {canRemoveParticipants && (
                              <button
                                type="button"
                                onClick={() => untagParticipant(p.userId)}
                                className="text-destructive hover:scale-110 transition-transform"
                                title={`Remove ${p.user.name ?? "participant"}`}
                              >
                                <UserMinus className="h-3 w-3" />
                              </button>
                            )}
                          </Badge>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Select value={participantPick} onValueChange={(v) => setParticipantPick(v || "")}>
                          <SelectTrigger className="h-9 flex-1 text-xs">
                            <SelectValue placeholder="Tag a staff member…" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableToTag.map((s) => (
                              <SelectItem key={s.id} value={s.id}>{s.name} — {s.role}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button size="sm" variant="outline" onClick={tagParticipant} disabled={!participantPick}>
                          <UserPlus className="h-4 w-4 mr-1.5" /> Tag
                        </Button>
                      </div>
                    </div>

                    <Separator />

                    {/* Internal discussion */}
                    <div className="space-y-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground inline-flex items-center gap-1.5">
                        <Lock className="h-3.5 w-3.5" /> Internal discussion (never visible to the student)
                      </p>
                      <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
                        {detail.internalNotes.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">No internal notes yet.</p>
                        )}
                        {detail.internalNotes.map((n) => (
                          <div key={n.id} className="flex gap-3">
                            <Avatar className="h-8 w-8 border shrink-0">
                              <AvatarFallback className="text-[10px] bg-amber-100 text-amber-800">
                                {initials(n.author?.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-sm flex-1">
                              <div className="flex items-center justify-between gap-2 mb-0.5">
                                <span className="font-semibold text-xs">{n.author?.name}</span>
                                <span className="text-[10px] text-muted-foreground">{new Date(n.createdAt).toLocaleString()}</span>
                              </div>
                              <p className="whitespace-pre-wrap">{n.content}</p>
                              {n.attachments.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {n.attachments.map((a) => (
                                    <AttachmentChip key={a.id} attachment={a} />
                                  ))}
                                </div>
                              )}
                              <div className="mt-2">
                                <FileUploadButton ticketId={detail.id} internalNoteId={n.id} onUploaded={refresh} label="Attach to note" />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="space-y-2">
                        <Textarea
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="Discuss internally with other SPOCs…"
                          rows={3}
                        />
                        <div className="flex justify-end">
                          <Button size="sm" onClick={sendNote} disabled={sendingNote || !note.trim()}>
                            {sendingNote ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Send className="h-4 w-4 mr-1.5" />}
                            Post internal note
                          </Button>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                )}
              </Tabs>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
