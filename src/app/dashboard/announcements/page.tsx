"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { getAnnouncementsForMe, deleteAnnouncement } from "./actions";
import { ANNOUNCEMENT_CATEGORIES, type AnnouncementCategory } from "@/lib/announcement-categories";
import { AnnouncementComposer } from "./announcement-composer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Megaphone, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Item = Awaited<ReturnType<typeof getAnnouncementsForMe>>[number];

const CATEGORY_META: Record<AnnouncementCategory, { label: string; cls: string }> = {
  ACADEMICS: { label: "Academics", cls: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800" },
  PLACEMENTS: { label: "Placements", cls: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800" },
  EVENTS: { label: "Events", cls: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800" },
  ALERTS: { label: "Alerts", cls: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800" },
};
const FILTERS = ["ALL", ...ANNOUNCEMENT_CATEGORIES] as const;

function targetChips(a: Item) {
  const t = a.targets[0];
  if (!t) return ["Campus-wide"];
  const chips: string[] = [];
  if (t.program) chips.push(t.program);
  if (t.semester) chips.push(`Sem ${t.semester}`);
  if (t.section) chips.push(`Section ${t.section}`);
  if (t.subject) chips.push(`${t.subject.code}`);
  return chips.length ? chips : ["Campus-wide"];
}

export default function AnnouncementsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("ALL");

  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await getAnnouncementsForMe());
    } catch {
      toast.error("Failed to load announcements");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const remove = async (id: string) => {
    if (!confirm("Delete this announcement for everyone?")) return;
    const res = await deleteAnnouncement(id);
    if (res.success) {
      toast.success("Announcement deleted");
      load();
    } else toast.error(res.error);
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: items.length };
    for (const cat of ANNOUNCEMENT_CATEGORIES) c[cat] = items.filter((a) => a.category === cat).length;
    return c;
  }, [items]);
  const filtered = filter === "ALL" ? items : items.filter((a) => a.category === filter);

  if (!user) return null;

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tighter uppercase">Announcements</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {isAdmin ? "Publish updates to the whole campus or a targeted audience." : "Updates relevant to you."}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setComposerOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> New Announcement
          </Button>
        )}
      </div>

      {/* Category filter tabs */}
      <div className="flex flex-wrap gap-1.5 border-b pb-3">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            title={f === "ALL" ? "Show every announcement" : `Show only ${CATEGORY_META[f].label}`}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide border transition-colors",
              filter === f
                ? "bg-foreground text-background border-foreground"
                : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            {f === "ALL" ? "All" : CATEGORY_META[f].label} <span className="opacity-70 font-medium normal-case">({counts[f] ?? 0})</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 border-dashed">
          <Megaphone className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">
            {items.length === 0 ? "No announcements yet." : `No ${filter === "ALL" ? "" : CATEGORY_META[filter as AnnouncementCategory].label.toLowerCase() + " "}announcements yet.`}
          </p>
        </Card>
      ) : (
        <div className="space-y-5">
          {filtered.map((a) => {
            const catMeta = CATEGORY_META[(a.category as AnnouncementCategory) ?? "ALERTS"] ?? CATEGORY_META.ALERTS;
            return (
            <Card key={a.id} className="overflow-hidden border-2">
              {a.bannerUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.bannerUrl} alt="" className="w-full max-h-56 object-cover border-b" />
              )}
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 font-bold uppercase", catMeta.cls)}>{catMeta.label}</Badge>
                    <CardTitle className="text-lg leading-tight">{a.title}</CardTitle>
                  </div>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive shrink-0"
                      title="Delete announcement"
                      onClick={() => remove(a.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <span>{a.author?.name}</span>
                  <span>·</span>
                  <span>{new Date(a.createdAt).toLocaleString()}</span>
                  <span>·</span>
                  {targetChips(a).map((c) => (
                    <Badge key={c} variant="outline" className="text-[10px] px-1.5 py-0">{c}</Badge>
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                <div
                  className="prose prose-sm max-w-none [&_a]:text-primary"
                  dangerouslySetInnerHTML={{ __html: a.contentHtml }}
                />
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}

      {isAdmin && (
        <AnnouncementComposer open={composerOpen} onOpenChange={setComposerOpen} onCreated={load} />
      )}
    </div>
  );
}
