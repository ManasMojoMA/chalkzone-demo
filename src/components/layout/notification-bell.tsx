"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Notification } from "@prisma/client";
import {
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/app/dashboard/notifications/actions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Bell, CheckCheck, FileCheck2, Megaphone, Ticket, Briefcase, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const POLL_MS = 45_000;

const TYPE_ICON: Record<string, React.ReactNode> = {
  TICKET: <Ticket className="h-4 w-4 text-blue-600" />,
  APPLICATION: <Briefcase className="h-4 w-4 text-emerald-600" />,
  APPRAISAL: <FileCheck2 className="h-4 w-4 text-violet-600" />,
  ANNOUNCEMENT: <Megaphone className="h-4 w-4 text-amber-600" />,
  SYSTEM: <Info className="h-4 w-4 text-slate-500" />,
};

function timeAgo(date: Date | string) {
  const ms = Date.now() - new Date(date).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function NotificationBell() {
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getMyNotifications();
      setItems(res.items);
      setUnread(res.unread);
    } catch {
      // silent — polling must never surface errors
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const onItemClick = async (n: Notification) => {
    setOpen(false);
    if (!n.isRead) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
      markNotificationRead(n.id);
    }
    if (n.link) router.push(n.link);
  };

  const markAll = async () => {
    setItems((prev) => prev.map((x) => ({ ...x, isRead: true })));
    setUnread(0);
    await markAllNotificationsRead();
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) load(); }}>
      <PopoverTrigger
        render={
          <button
            type="button"
            title="Notifications" data-tour="__bell"
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border-2 border-slate-900 dark:border-border bg-white dark:bg-card shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] dark:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.6)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] transition-all"
          />
        }
      >
        <Bell className="h-4 w-4" aria-hidden />
        {unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center px-1 border border-slate-900 dark:border-border">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/40">
          <span className="font-bold text-sm">Notifications</span>
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAll}>
              <CheckCheck className="h-3.5 w-3.5 mr-1" /> Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-[380px] overflow-y-auto">
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-10">You&apos;re all caught up.</p>
          )}
          {items.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => onItemClick(n)}
              className={cn(
                "w-full text-left px-4 py-3 border-b last:border-b-0 flex gap-3 hover:bg-muted/40 transition-colors",
                !n.isRead && "bg-primary/5"
              )}
            >
              <span className="mt-0.5 shrink-0">{TYPE_ICON[n.type] ?? TYPE_ICON.SYSTEM}</span>
              <span className="min-w-0">
                <span className={cn("block text-sm leading-snug", !n.isRead && "font-semibold")}>{n.title}</span>
                {n.body && <span className="block text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.body}</span>}
                <span className="block text-[10px] text-muted-foreground mt-1">{timeAgo(n.createdAt)}</span>
              </span>
              {!n.isRead && <span className="ml-auto mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
