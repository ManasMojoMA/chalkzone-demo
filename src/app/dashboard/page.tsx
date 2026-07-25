"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, Calendar, Briefcase, FileText, CheckCircle2, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { WeekScheduleCard } from "@/components/week-schedule-card";
import { getDashboardStats, type DashboardStat } from "./actions";
import { getMyNotifications } from "./notifications/actions";

const STAT_ICONS = [Calendar, FileText, Ticket, Briefcase];

type ActivityItem = Awaited<ReturnType<typeof getMyNotifications>>["items"][number];

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStat[] | null>(null);
  const [activity, setActivity] = useState<ActivityItem[] | null>(null);

  useEffect(() => {
    if (!user) return;
    getDashboardStats()
      .then(setStats)
      .catch((error) => {
        console.error("Failed to load dashboard stats:", error);
        setStats([]);
      });
    getMyNotifications()
      .then((r) => setActivity(r.items.slice(0, 5)))
      .catch(() => setActivity([]));
  }, [user]);

  if (!user) return null;

  // Simple greeting based on time
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in duration-500">

      {/* Welcome Banner */}
      <div className="bg-white dark:bg-card rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-4 border-slate-900 dark:border-border shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] dark:shadow-[8px_8px_0px_0px_rgba(0,0,0,0.6)] relative overflow-hidden">
        <div className="absolute -bottom-6 -right-6 w-32 h-32 opacity-10 bg-[radial-gradient(#0f172a_2px,transparent_2px)] [background-size:8px_8px] pointer-events-none" />
        <div>
          <h2 className="text-2xl md:text-3xl font-black tracking-tighter uppercase text-foreground">
            {greeting}, {user.name}!
          </h2>
          <p className="text-muted-foreground mt-1 font-medium">
            Welcome to <span className="font-black uppercase tracking-tight text-foreground">Chalk<span className="text-primary">Zone</span></span> — you are signed in as a <strong className="text-foreground">{user.role.replace("_", " ")}</strong>.
          </p>
        </div>
        <div className="hidden md:flex p-3 bg-primary rounded-xl border-2 border-slate-900 dark:border-border shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
          <GraduationCap className="h-8 w-8 text-white" />
        </div>
      </div>

      {/* Live Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats === null
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-16 mt-2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-3 w-32" />
                </CardContent>
              </Card>
            ))
          : stats.map((stat, i) => {
              const Icon = STAT_ICONS[i % STAT_ICONS.length];
              const iconColors = ["bg-primary/10 text-primary", "bg-secondary/10 text-secondary", "bg-accent/20 text-accent-foreground", "bg-primary/10 text-primary"];
              return (
                <Card key={stat.label} className="border-2 border-slate-900 dark:border-border shadow-[5px_5px_0px_0px_rgba(15,23,42,1)] dark:shadow-[5px_5px_0px_0px_rgba(0,0,0,0.6)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] transition-all rounded-xl">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs font-bold uppercase tracking-wide text-muted-foreground flex items-center justify-between">
                      {stat.label}
                      <span className={`p-1.5 rounded-lg border-2 border-slate-900 dark:border-border ${iconColors[i % iconColors.length]}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                    </CardDescription>
                    <CardTitle className="text-3xl font-black tracking-tight">{stat.value}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xs text-muted-foreground font-medium">{stat.hint}</div>
                  </CardContent>
                </Card>
              );
            })}
      </div>

      {/* This week's classes (students & faculty with a linked timetable) */}
      <WeekScheduleCard />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
        {/* Main Content Area — the user's real latest notifications */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Your latest notifications across the platform.</CardDescription>
          </CardHeader>
          <CardContent>
            {activity === null ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : activity.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500/70" />
                All caught up — replies, announcements and assignments will appear here.
              </div>
            ) : (
              <div className="space-y-5">
                {activity.map((n) => (
                  <div key={n.id} className="flex items-start">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full mt-0.5 ${n.isRead ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}>
                      <CheckCircle2 className="h-4 w-4" />
                    </span>
                    <div className="ml-4 space-y-0.5 min-w-0">
                      <p className="text-sm font-medium leading-tight">{n.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{n.body}</p>
                      <p className="text-[10px] text-muted-foreground/70 font-medium">{new Date(n.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="hover:shadow-sm transition-shadow">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Commonly used tools and shortcuts.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Link href="/dashboard/tickets">
              <Button variant="outline" className="w-full justify-start h-10">
                <Ticket className="mr-2 h-4 w-4" />
                Raise a New Ticket
              </Button>
            </Link>
            <Link href="/dashboard/performance">
              <Button variant="outline" className="w-full justify-start h-10">
                <FileText className="mr-2 h-4 w-4" />
                View Performance
              </Button>
            </Link>
            <Link href="/dashboard/timetable">
              <Button variant="outline" className="w-full justify-start h-10">
                <Calendar className="mr-2 h-4 w-4" />
                View Timetable
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
