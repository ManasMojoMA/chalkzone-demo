"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { chatWithAI } from "@/app/dashboard/knowledge-base/actions";
import { Chalkie, type ChalkieScene } from "@/components/chat/chalkie";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircleQuestion, Minus, Send } from "lucide-react";
import { cn } from "@/lib/utils";

type Message = { role: "user" | "ai"; content: string };

const STORE_KEY = "cz-chat-history";
const TIPS = [
  "Ask me about the attendance policy!",
  "Try: “What grade do I get for 85 marks?”",
  "I can explain CGPA calculation…",
  "Stuck? Raise a ticket — or ask me first!",
  "I read the university's policy documents.",
];
// Chalkie's stationary antics (walking is handled separately by the roam loop)
const ANTICS: ChalkieScene[] = ["sit", "eat", "juggle", "think", "write", "clap", "sneeze", "wave", "sit", "eat"];
const WALK_SPEED = 90; // px per second

export function ChatWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [scene, setScene] = useState<ChalkieScene>("idle");
  const [tip, setTip] = useState(TIPS[0]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ── Free roaming: Chalkie wanders the bottom of the screen ──
  const [roamX, setRoamX] = useState(0); // 0 = home beside the launcher; negative = to the left
  const [roamDur, setRoamDur] = useState(0.6);
  const [facing, setFacing] = useState<1 | -1>(1);
  const roamXRef = useRef(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = useCallback((fn: () => void, ms: number) => {
    timersRef.current.push(setTimeout(fn, ms));
  }, []);
  useEffect(() => () => { timersRef.current.forEach(clearTimeout); }, []);

  const walkTo = useCallback((target: number) => {
    const cur = roamXRef.current;
    const dist = Math.abs(target - cur);
    if (dist < 14) return;
    roamXRef.current = target;
    setFacing(target < cur ? -1 : 1);
    const sec = Math.max(0.6, dist / WALK_SPEED);
    setRoamDur(sec);
    setScene("walk");
    setRoamX(target);
    later(() => { setScene((m) => (m === "walk" ? "idle" : m)); setFacing(1); }, sec * 1000);
  }, [later]);

  /** Hovering his body makes him scamper aside so you can reach whatever
   *  he was standing on (chat stays reachable via the launcher button). */
  const dodge = useCallback(() => {
    if (scene === "walk") return;
    const cur = roamXRef.current;
    const maxRoam = Math.max(0, Math.min(window.innerWidth - 340, 880));
    // never dodge back underneath the open chat panel
    const rightLimit = open ? -320 : 0;
    const target = cur > -170 + rightLimit ? Math.max(-maxRoam, cur - 180) : Math.min(rightLimit, cur + 180);
    walkTo(target);
  }, [scene, walkTo, open]);

  // Restore conversation across page navigations
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORE_KEY);
      if (raw) setMessages(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify(messages.slice(-40))); } catch { /* ignore */ }
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // The chat panel (≈370px wide, anchored bottom-right) covers his home spot —
  // when it opens he immediately steps out to its left so he stays visible.
  const PANEL_CLEARANCE = -320;
  useEffect(() => {
    if (open && roamXRef.current > PANEL_CLEARANCE + 40) walkTo(PANEL_CLEARANCE);
    if (!open) walkTo(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Chalkie's life loop: wander somewhere, or stop and do something silly.
  useEffect(() => {
    const t = setInterval(() => {
      if (busy) return; // thinking pose is handled by busy state
      if (open && roamXRef.current > PANEL_CLEARANCE + 40) { walkTo(PANEL_CLEARANCE); return; }
      const roll = Math.random();
      if (roll < 0.38) {
        // wander to a random spot along the bottom of the screen
        // (never under the open chat panel)
        const maxRoam = Math.max(0, Math.min(window.innerWidth - 340, 880));
        const target = -Math.random() * maxRoam;
        walkTo(open ? Math.min(target, PANEL_CLEARANCE) : target);
        return;
      }
      const next = ANTICS[Math.floor(Math.random() * ANTICS.length)];
      setScene(next);
      if (next === "think") setTip(TIPS[Math.floor(Math.random() * TIPS.length)]);
      if (next === "clap") {
        // the duster dust cloud catches up with him…
        later(() => setScene((m) => (m === "clap" ? "cough" : m)), 4200);
        later(() => setScene((m) => (m === "cough" ? "idle" : m)), 8000);
      } else {
        later(() => setScene((m) => (m === next ? "idle" : m)), next === "sit" ? 8200 : 5400);
      }
    }, 10000);
    return () => clearInterval(t);
  }, [busy, open, walkTo, later]);

  const send = useCallback(async () => {
    const q = input.trim();
    if (!q || busy) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setBusy(true);
    setScene("think");
    setTip("Hmm, let me check the handbook…");
    try {
      const fd = new FormData();
      fd.append("question", q);
      const res = await chatWithAI(fd);
      setMessages((prev) => [
        ...prev,
        { role: "ai", content: res.response ?? res.error ?? "Sorry, something went wrong — try again." },
      ]);
      setScene("wave");
      setTimeout(() => setScene("idle"), 1800);
    } catch {
      setMessages((prev) => [...prev, { role: "ai", content: "I couldn't reach the AI service. Please try again." }]);
      setScene("idle");
    } finally {
      setBusy(false);
    }
  }, [input, busy]);

  // The dedicated AI page already hosts the full chat — don't double up there
  if (pathname?.startsWith("/dashboard/ai-assistant")) return null;

  return (
    <>
      {/* Chalkie wanders the bottom of the screen in his own click-transparent
          layer — only his body is interactive, and hovering it makes him
          scamper aside so he never traps a button underneath. */}
      <div
        className="fixed bottom-1 z-40 pointer-events-none"
        data-tour="__chalkie"
        style={{
          right: 118,
          transform: `translateX(${roamX}px)`,
          transition: `transform ${roamDur}s linear`,
        }}
      >
        <Chalkie
          scene={busy ? "think" : scene}
          thought={busy || scene === "think" ? tip : undefined}
          size={88}
          flip={facing === -1}
          onPoke={() => setOpen((o) => !o)}
          onHover={dodge}
        />
      </div>

    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end">
      {/* Expanded panel */}
      {open && (
        <div className="w-[min(92vw,370px)] h-[500px] flex flex-col rounded-2xl border-4 border-slate-900 dark:border-border bg-white dark:bg-card shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] dark:shadow-[8px_8px_0px_0px_rgba(0,0,0,0.6)] overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200">
          {/* Header — chalkboard */}
          <div className="flex items-center gap-3 px-4 py-3 bg-[#35564e] border-b-4 border-slate-900">
            <div className="flex-1 leading-tight">
              <p className="font-black uppercase tracking-tight text-white text-sm">
                Chalkie <span className="text-white/60 font-semibold normal-case">· ChalkZone Assistant</span>
              </p>
              <p className="text-[10px] text-white/70 font-medium">
                {busy ? "scribbling an answer…" : "ask about policies, grades, campus life"}
              </p>
            </div>
            <button
              type="button"
              title="Minimize chat"
              onClick={() => setOpen(false)}
              className="h-7 w-7 rounded-md bg-white/10 text-white hover:bg-white/25 flex items-center justify-center transition-colors"
            >
              <Minus className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 bg-[radial-gradient(rgba(15,23,42,0.05)_1px,transparent_1px)] [background-size:14px_14px]">
            {messages.length === 0 && (
              <div className="text-center text-xs text-muted-foreground pt-10 px-6">
                <p className="font-semibold text-sm text-foreground mb-1">Hi, I&apos;m Chalky! 👋</p>
                Ask me anything about attendance, grading, placements or campus policies — I&apos;ve read the handbook so you don&apos;t have to.
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap border-2",
                    m.role === "user"
                      ? "bg-primary text-white border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
                      : "bg-white dark:bg-muted border-slate-900/20 dark:border-border"
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="rounded-xl px-3 py-2.5 bg-white dark:bg-muted border-2 border-slate-900/20 dark:border-border inline-flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="cz-typing-dot h-1.5 w-1.5 rounded-full bg-slate-500" style={{ animationDelay: `${i * 0.18}s` }} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => { e.preventDefault(); send(); }}
            className="flex items-center gap-2 p-3 border-t-2 border-slate-900/10 dark:border-border bg-white dark:bg-card"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Chalkie…"
              className="h-9 text-sm border-2 border-slate-900/30 focus-visible:ring-primary"
              disabled={busy}
            />
            <Button type="submit" size="icon" className="h-9 w-9 shrink-0 border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]" disabled={busy || !input.trim()}>
              <Send className="h-4 w-4" />
              <span className="sr-only">Send</span>
            </Button>
          </form>
        </div>
      )}

      {/* Collapsed launcher — a small chalkboard; Chalkie stands beside it */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Chat with Chalkie, the ChalkZone assistant"
          className="group relative h-14 w-14 rounded-2xl bg-[#35564e] border-4 border-slate-900 dark:border-border shadow-[5px_5px_0px_0px_rgba(15,23,42,1)] dark:shadow-[5px_5px_0px_0px_rgba(0,0,0,0.6)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] transition-all flex items-center justify-center"
        >
          <MessageCircleQuestion className="h-7 w-7 text-white/90" aria-hidden />
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-accent border-2 border-slate-900 group-hover:scale-125 transition-transform" />
        </button>
      )}
    </div>
    </>
  );
}
