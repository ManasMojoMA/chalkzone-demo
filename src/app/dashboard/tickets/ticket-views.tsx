"use client";

import { TicketStatus } from "@prisma/client";
import type { TicketWithRelations } from "@/lib/types";
import { STATUS_META, STATUS_ORDER, PRIORITY_META, isTicketEscalated, slaCountdown } from "@/lib/ticket-meta";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlarmClock, Paperclip, UserRound } from "lucide-react";
import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  TouchSensor,
  DragStartEvent,
  DragEndEvent,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";

// ─── Shared card ────────────────────────────────────────────────────────────

export function EscalatedBadge() {
  return (
    <Badge className="bg-red-100 text-red-700 border border-red-400 gap-1 animate-pulse">
      <AlarmClock className="h-3 w-3" />
      Escalated
    </Badge>
  );
}

export function TicketCardBody({ ticket }: { ticket: TicketWithRelations }) {
  const meta = STATUS_META[ticket.status];
  const prio = PRIORITY_META[ticket.priority];
  const escalated = isTicketEscalated(ticket);

  return (
    <>
      <CardHeader className="p-2.5 pb-1">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-xs font-semibold leading-tight line-clamp-1">{ticket.title}</CardTitle>
          {escalated && <EscalatedBadge />}
        </div>
      </CardHeader>
      <CardContent className="p-2.5 pt-0 text-muted-foreground">
        <p className="line-clamp-1 mb-1.5 text-[11px]">{ticket.description}</p>
        <div className="flex items-center justify-between gap-1.5 flex-wrap">
          <div className="flex items-center gap-1">
            <Badge variant="outline" className="text-[9px] px-1 py-0">{ticket.category?.name}</Badge>
            <Badge variant="outline" className={cn("text-[9px] px-1 py-0 border", prio.badge)}>{prio.label}</Badge>
            {ticket.slaDeadline && ticket.status !== "RESOLVED" && ticket.status !== "CLOSED" && (
              <span className={cn("text-[9px] font-medium inline-flex items-center gap-0.5", escalated ? "text-red-600" : "text-muted-foreground")}>
                <AlarmClock className="h-2.5 w-2.5" />
                {slaCountdown(ticket.slaDeadline)}
              </span>
            )}
          </div>
          <span className="text-[9px] font-medium text-foreground inline-flex items-center gap-0.5">
            <UserRound className="h-2.5 w-2.5" />
            {ticket.creator?.name || "Student"}
          </span>
        </div>
      </CardContent>
    </>
  );
}

// ─── List view ──────────────────────────────────────────────────────────────

export function TicketListView({
  tickets,
  onOpen,
}: {
  tickets: TicketWithRelations[];
  onOpen: (t: TicketWithRelations) => void;
}) {
  if (tickets.length === 0) {
    return (
      <div className="text-center py-12 border-2 border-dashed rounded-lg bg-muted/10 text-muted-foreground">
        No tickets here yet.
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {tickets.map((ticket) => {
        const meta = STATUS_META[ticket.status];
        return (
          <Card
            key={ticket.id}
            onClick={() => onOpen(ticket)}
            className={cn(
              "cursor-pointer overflow-hidden border-l-4 transition-all hover:shadow-md hover:-translate-y-0.5",
              meta.border
            )}
          >
            <div className="flex items-center justify-between px-4 pt-3">
              <Badge variant="outline" className={cn("border", meta.badge)}>
                <span className={cn("mr-1.5 inline-block h-2 w-2 rounded-full", meta.dot)} />
                {meta.label}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {new Date(ticket.createdAt).toLocaleString()}
              </span>
            </div>
            <TicketCardBody ticket={ticket} />
          </Card>
        );
      })}
    </div>
  );
}

// ─── Kanban view ────────────────────────────────────────────────────────────

function KanbanCard({
  ticket,
  draggable,
  onOpen,
}: {
  ticket: TicketWithRelations;
  draggable: boolean;
  onOpen: (t: TicketWithRelations) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: ticket.id,
    data: { ticket },
    disabled: !draggable,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  const meta = STATUS_META[ticket.status];

  return (
    <Card
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={style}
      onClick={() => onOpen(ticket)}
      className={cn(
        "border-l-4 transition-colors shadow-sm touch-manipulation z-10 relative bg-card",
        meta.border,
        draggable ? "cursor-grab active:cursor-grabbing hover:border-primary/50" : "cursor-pointer hover:shadow-md"
      )}
    >
      <TicketCardBody ticket={ticket} />
    </Card>
  );
}

function KanbanColumn({
  status,
  tickets,
  draggable,
  onOpen,
}: {
  status: TicketStatus;
  tickets: TicketWithRelations[];
  draggable: boolean;
  onOpen: (t: TicketWithRelations) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled: !draggable });
  const meta = STATUS_META[status];

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex-shrink-0 w-full md:w-80 border-2 rounded-lg p-3 flex flex-col transition-colors",
        meta.column,
        isOver && "ring-2 ring-primary/60"
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-sm uppercase tracking-wide inline-flex items-center gap-2">
          <span className={cn("inline-block h-2.5 w-2.5 rounded-full", meta.dot)} />
          {meta.label}
        </h2>
        <Badge variant="secondary" className="px-2">{tickets.length}</Badge>
      </div>
      {/* ~5 compact cards visible; column scrolls beyond that */}
      <div className="flex-1 space-y-2 overflow-y-auto min-h-[120px] max-h-[420px] pr-0.5">
        {tickets.map((ticket) => (
          <KanbanCard key={ticket.id} ticket={ticket} draggable={draggable} onOpen={onOpen} />
        ))}
        {tickets.length === 0 && (
          <div className="h-20 border-2 border-dashed border-black/10 dark:border-white/10 rounded-md flex items-center justify-center text-muted-foreground text-xs p-4 text-center pointer-events-none">
            {draggable ? "Drop here" : "Empty"}
          </div>
        )}
      </div>
    </div>
  );
}

export function TicketKanbanView({
  tickets,
  draggable,
  onOpen,
  onStatusChange,
}: {
  tickets: TicketWithRelations[];
  draggable: boolean;
  onOpen: (t: TicketWithRelations) => void;
  onStatusChange: (ticketId: string, status: TicketStatus) => void;
}) {
  const [activeTicket, setActiveTicket] = useState<TicketWithRelations | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  const handleDragStart = (e: DragStartEvent) => {
    setActiveTicket(e.active.data.current?.ticket ?? null);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveTicket(null);
    const { active, over } = e;
    if (!over) return;
    const ticketId = active.id as string;
    const newStatus = over.id as TicketStatus;
    const moved = tickets.find((t) => t.id === ticketId);
    if (!moved || moved.status === newStatus) return;
    onStatusChange(ticketId, newStatus);
  };

  const board = (
    <div className="flex flex-col md:flex-row gap-4 overflow-x-auto pb-4 flex-1">
      {STATUS_ORDER.map((status) => (
        <KanbanColumn
          key={status}
          status={status}
          tickets={tickets.filter((t) => t.status === status)}
          draggable={draggable}
          onOpen={onOpen}
        />
      ))}
    </div>
  );

  if (!draggable) return board;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      {board}
      <DragOverlay>
        {activeTicket ? (
          <Card className={cn("border-l-4 bg-card shadow-lg", STATUS_META[activeTicket.status].border)}>
            <TicketCardBody ticket={activeTicket} />
          </Card>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
