"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { markTourSeen } from "@/app/dashboard/profile/actions";
import { Chalkie } from "@/components/chat/chalkie";
import { Button } from "@/components/ui/button";

const FORCE_KEY = "cz-tour-force";

/** One line (or two) per section — Chalkie reads these out on his tour. */
const TOUR_TEXT: Record<string, string> = {
  Dashboard: "Your home base — live stats and quick actions at a glance.",
  "My Attendance": "Track attendance per subject; below 75% turns red — don't let it!",
  "My Performance": "Marks, grades and your credit-weighted CGPA live here.",
  "My Resumes": "Build resumes here — your newest one is attached when you apply for jobs.",
  "Jobs & Internships": "Browse postings, apply in one click and track every stage of your application.",
  "Jobs & Applications": "Manage postings and drag applications through the hiring pipeline.",
  Tickets: "Something broken or blocked? Raise a ticket and chat with the team here.",
  Timetable: "Your weekly class schedule — rooms, times and teachers.",
  Announcements: "Official campus updates land here (and in your notifications).",
  "User Management": "Manage every account: roles, activation and access.",
  Configuration: "Set up courses, faculty designations with hour caps, and classrooms — used everywhere.",
  "System Settings": "Master controls — ticket SLAs and escalation policy.",
  Attendance: "Mark and review class attendance.",
  "Mark Attendance": "Mark students present or absent per class, per subject.",
  Performance: "Enter and review marks; CGPA updates automatically.",
  "Student Performance": "Enter marks with validation; grades compute themselves.",
  Placements: "Postings, applications pipeline and internship logs.",
  Appraisals: "Yearly self-appraisals and evaluations.",
  "My Appraisals": "Submit your self-appraisal for the open cycle here.",
  "Knowledge Base": "Documents added here power Chalkie's AI answers.",
  __bell: "Your notification bell — replies, assignments and announcements ping here.",
  __chalkie: "And this is me! Poke me anytime — I answer questions about policies, grades and campus life.",
};

type Step = { key: string; title: string; text: string };

export function OnboardingTour() {
  const { user, loadUser } = useAuth();
  const [active, setActive] = useState(false);
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const steps: Step[] = useMemo(() => {
    if (typeof document === "undefined") return [];
    const found: Step[] = [];
    for (const [key, text] of Object.entries(TOUR_TEXT)) {
      const el = document.querySelector(`[data-tour="${key}"]`);
      if (el) found.push({ key, title: key.startsWith("__") ? (key === "__bell" ? "Notifications" : "Chalkie") : key, text });
    }
    return found;
    // re-scan when the tour activates (sidebar is mounted by then)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Trigger: first login (hasSeenTour false) or a forced replay from Settings
  useEffect(() => {
    if (!user) return;
    const force = localStorage.getItem(FORCE_KEY) === "1";
    if (force || !user.hasSeenTour) {
      localStorage.removeItem(FORCE_KEY);
      // small delay so the sidebar has rendered
      const t = setTimeout(() => { setIdx(0); setActive(true); }, 900);
      return () => clearTimeout(t);
    }
  }, [user]);

  const measure = useCallback(() => {
    const step = steps[idx];
    if (!step) return setRect(null);
    const el = document.querySelector(`[data-tour="${step.key}"]`);
    setRect(el ? el.getBoundingClientRect() : null);
  }, [steps, idx]);

  useEffect(() => {
    if (!active) return;
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [active, measure]);

  const finish = async () => {
    setActive(false);
    try {
      await markTourSeen();
      loadUser();
    } catch { /* non-fatal */ }
  };

  if (!active || steps.length === 0) return null;
  const step = steps[idx];
  const last = idx === steps.length - 1;

  // Tooltip placement: right of sidebar items, left of bell/chalkie
  const onRightEdge = rect ? rect.left > window.innerWidth / 2 : false;
  const tipTop = rect ? Math.min(Math.max(rect.top - 20, 16), window.innerHeight - 240) : 100;
  const tipLeft = rect
    ? onRightEdge
      ? Math.max(rect.left - 372, 16)
      : Math.min(rect.right + 16, window.innerWidth - 372)
    : 100;

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-label="Platform walkthrough">
      {/* Spotlight: the highlight ring carries a huge shadow that dims everything else */}
      {rect && (
        <div
          className="absolute rounded-xl ring-4 ring-accent transition-all duration-500 pointer-events-none"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.72)",
          }}
        />
      )}
      {!rect && <div className="absolute inset-0 bg-slate-900/72" />}

      {/* Chalkie + explanation card — he "walks" between sections via the position transition */}
      <div
        className="absolute w-[356px] transition-all duration-500 ease-out"
        style={{ top: tipTop, left: tipLeft }}
      >
        <div className="flex items-end gap-1 -mb-3 ml-2 relative z-10">
          <Chalkie scene={idx % 3 === 0 ? "wave" : idx % 3 === 1 ? "write" : "idle"} size={64} />
        </div>
        <div className="rounded-2xl border-4 border-slate-900 bg-white p-4 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)]">
          <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">
            Chalkie's tour · {idx + 1}/{steps.length}
          </p>
          <h3 className="font-black text-lg text-slate-900 leading-tight">{step.title}</h3>
          <p className="text-sm text-slate-600 font-medium mt-1">{step.text}</p>
          <div className="flex items-center justify-between mt-4">
            <button type="button" onClick={finish} className="text-xs font-semibold text-slate-400 hover:text-slate-700">
              Skip tour
            </button>
            <div className="flex gap-2">
              {idx > 0 && (
                <Button size="sm" variant="outline" onClick={() => setIdx((i) => i - 1)}>
                  Back
                </Button>
              )}
              <Button size="sm" onClick={() => (last ? finish() : setIdx((i) => i + 1))}>
                {last ? "Let's go!" : "Next"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
