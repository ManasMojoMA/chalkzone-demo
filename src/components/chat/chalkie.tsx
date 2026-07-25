"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type ChalkieScene =
  | "idle" | "walk" | "juggle" | "clap" | "cough" | "write" | "wave" | "think"
  | "eat" | "sit" | "sneeze";

/**
 * Chalkie v4 — ChalkZone's mascot. Shaded cartoon chalk character (red cap,
 * chalkboard-green dungarees, red shoes) visible on both themes. Antics:
 * juggling, duster-clap into a dust cloud, COUGHING in the dust, eating a
 * chalk stick and instantly regretting it, sitting down for a breather,
 * sneezing, writing, waving, thinking. Eyes track the pointer.
 *
 * Clicks pass straight through everything except his body — only a body-shaped
 * hit area is interactive, so he never blocks buttons behind/around him.
 * Hovering his body fires onHover (the widget makes him scamper aside).
 */
export function Chalkie({
  scene = "idle",
  thought,
  size = 96,
  className,
  onPoke,
  onHover,
  flip = false,
}: {
  scene?: ChalkieScene;
  thought?: string;
  size?: number;
  className?: string;
  onPoke?: () => void;
  onHover?: () => void;
  /** Mirror the artwork horizontally (facing left while walking). */
  flip?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pupil, setPupil] = useState({ x: 0, y: 0 });
  const [poked, setPoked] = useState(false);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 3);
      const dist = Math.hypot(dx, dy);
      if (dist > 600) return setPupil({ x: 0, y: 0 });
      const mag = Math.min(1.6, dist / 140);
      setPupil({ x: (dx / (dist || 1)) * mag, y: (dy / (dist || 1)) * mag });
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  const poke = () => {
    setPoked(true);
    setTimeout(() => setPoked(false), 800);
    onPoke?.();
  };

  const s: ChalkieScene = poked ? "wave" : scene;
  const sitting = s === "sit";
  const customFace = s === "eat" || s === "cough" || s === "sneeze";

  return (
    <div
      ref={ref}
      role="img"
      aria-label="Chalkie, the ChalkZone mascot"
      className={cn(
        // The wrapper is click-transparent; only the body hit-ellipse (inside
        // the svg) captures the pointer, so UI behind him stays usable.
        "relative select-none pointer-events-none",
        "[--czk-line:#475569] [--czk-line-soft:rgba(71,85,105,0.55)] dark:[--czk-line:rgba(226,232,240,0.92)] dark:[--czk-line-soft:rgba(226,232,240,0.45)]",
        // Subtle separation only — the harsh white bloom in dark mode was
        // reported as hurting the eyes, so this is a faint halo, not a glow.
        "drop-shadow-[0_2px_3px_rgba(15,23,42,0.25)] dark:drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]",
        className
      )}
      style={{ width: size, height: size * 1.15 }}
    >
      {/* Thought cloud — free-standing, never clipped */}
      {s === "think" && thought && (
        <div
          aria-hidden
          className="absolute bottom-[105%] right-1/3 w-48 rounded-2xl border-2 border-slate-900 dark:border-slate-200 bg-white dark:bg-slate-800 px-3 py-2 text-[11px] font-semibold leading-snug text-slate-800 dark:text-slate-100 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] dark:shadow-[3px_3px_0px_0px_rgba(226,232,240,0.6)] czm-cloud z-10"
        >
          {thought}
          <span className="absolute -bottom-2.5 right-6 h-3 w-3 rounded-full border-2 border-slate-900 dark:border-slate-200 bg-white dark:bg-slate-800" />
          <span className="absolute -bottom-5 right-4 h-2 w-2 rounded-full border-2 border-slate-900 dark:border-slate-200 bg-white dark:bg-slate-800" />
        </div>
      )}

      <svg
        viewBox="0 0 100 115"
        width={size}
        height={size * 1.15}
        aria-hidden
        className={cn(
          "overflow-visible",
          s === "idle" && "czm-bob",
          s === "walk" && "czk-walkbob",
          poked && "czm-jump",
          s === "clap" && "czk-shake",
          s === "cough" && "czk-cough",
          s === "sneeze" && "czk-sneeze"
        )}
        style={{ pointerEvents: "none", transform: flip ? "scaleX(-1)" : undefined }}
      >
        <defs>
          <radialGradient id="czkSkin" cx="42%" cy="32%" r="75%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="62%" stopColor="#eef2f7" />
            <stop offset="100%" stopColor="#c9d2de" />
          </radialGradient>
          <linearGradient id="czkLimb" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f8fafc" />
            <stop offset="100%" stopColor="#cbd5e1" />
          </linearGradient>
          <linearGradient id="czkRed" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f87171" />
            <stop offset="55%" stopColor="#dc2626" />
            <stop offset="100%" stopColor="#991b1b" />
          </linearGradient>
          <linearGradient id="czkBoard" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4a7d70" />
            <stop offset="100%" stopColor="#2b4a42" />
          </linearGradient>
          <filter id="czkGrain" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" result="n" />
            <feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.16 0" result="grain" />
            <feComposite in="grain" in2="SourceGraphic" operator="in" />
          </filter>
        </defs>

        {/* ground shadow */}
        <ellipse cx="50" cy="110" rx={sitting ? 27 : 24} ry="4.5" fill="rgba(15,23,42,0.18)" />

        {/* ambient chalk dust motes */}
        <circle className="czm-dust" cx="12" cy="30" r="1.2" fill="var(--czk-line-soft)" />
        <circle className="czm-dust" cx="90" cy="46" r="1" fill="var(--czk-line-soft)" style={{ animationDelay: "1.2s" }} />

        {/* A little chalk-drawn stool appears under him when sitting, so he
            rests on something instead of hovering in mid-air. Drawn before the
            figure so the body sits in front of the seat. */}
        {sitting && (
          <g stroke="var(--czk-line)" strokeLinecap="round" fill="none">
            <path d="M32 99 h36" strokeWidth="3.2" />
            <path d="M35 99 l-3 11 M65 99 l3 11 M44 99 l-1.5 11 M56 99 l1.5 11" strokeWidth="2.4" />
          </g>
        )}

        {/* the whole figure sinks a little when sitting */}
        <g transform={sitting ? "translate(0 9)" : undefined}>

        {/* ── juggling chalk sticks ── */}
        {s === "juggle" && (
          <g>
            <g className="czk-jug1"><rect x="30" y="8" width="9" height="3.6" rx="1.8" fill="#ffffff" stroke="var(--czk-line)" strokeWidth="0.8" /></g>
            <g className="czk-jug2"><rect x="46" y="4" width="9" height="3.6" rx="1.8" fill="#93c5fd" stroke="var(--czk-line)" strokeWidth="0.8" transform="rotate(30 50 6)" /></g>
            <g className="czk-jug3"><rect x="62" y="8" width="9" height="3.6" rx="1.8" fill="#fde68a" stroke="var(--czk-line)" strokeWidth="0.8" transform="rotate(-25 66 10)" /></g>
          </g>
        )}

        {/* ── floating mini-board ── */}
        {s === "write" && (
          <g>
            <rect x="64" y="24" width="36" height="27" rx="3.5" fill="#8b5a2b" />
            <rect x="66.5" y="26.5" width="31" height="22" rx="2" fill="#35564e" />
            <path className="czk-scribble" d="M70 34 q6 -3 11 0 t11 0 M70 42 q7 3 13 0" fill="none" stroke="#ffffff" strokeWidth="1.7" strokeLinecap="round" pathLength={100} />
          </g>
        )}

        {/* ── powder burst while clapping dusters ── */}
        {s === "clap" && (
          <g className="czk-burst">
            {[...Array(10)].map((_, i) => (
              <circle key={i} cx={50 + Math.cos((i * Math.PI) / 5) * 3} cy={62 + Math.sin((i * Math.PI) / 5) * 3} r={i % 2 ? 1.4 : 2}
                fill="#ffffff" stroke="var(--czk-line-soft)" strokeWidth="0.4"
                style={{ ["--bx" as string]: `${Math.cos((i * Math.PI) / 5) * 24}px`, ["--by" as string]: `${Math.sin((i * Math.PI) / 5) * 18 - 8}px`, animationDelay: `${0.55 + i * 0.02}s` }}
                className="czk-particle" />
            ))}
          </g>
        )}

        {/* ── lingering dust cloud while coughing ── */}
        {s === "cough" && (
          <g>
            {[[30, 22, 3.2, 0], [70, 18, 2.6, 0.5], [50, 12, 3.6, 0.9], [22, 38, 2.2, 0.3], [80, 34, 2.4, 0.7]].map(([x, y, r, d], i) => (
              <circle key={i} className="czk-dusthover" cx={x} cy={y} r={r} fill="rgba(255,255,255,0.85)" stroke="var(--czk-line-soft)" strokeWidth="0.5" style={{ animationDelay: `${d}s` }} />
            ))}
            {/* puffs escaping his mouth with each cough */}
            <circle className="czk-cough-puff" cx="58" cy="48" r="2.4" fill="rgba(255,255,255,0.9)" stroke="var(--czk-line-soft)" strokeWidth="0.5" />
            <circle className="czk-cough-puff" cx="60" cy="50" r="1.6" fill="rgba(255,255,255,0.85)" style={{ animationDelay: "0.35s" }} />
          </g>
        )}

        {/* ── sneeze burst ── */}
        {s === "sneeze" && (
          <g>
            {[...Array(6)].map((_, i) => (
              <circle key={i} cx="56" cy="44" r={i % 2 ? 1.2 : 1.7} fill="#ffffff" stroke="var(--czk-line-soft)" strokeWidth="0.4"
                style={{ ["--bx" as string]: `${14 + i * 4}px`, ["--by" as string]: `${(i - 2.5) * 5}px`, animationDelay: `${1.2 + i * 0.04}s` }}
                className="czk-particle" />
            ))}
          </g>
        )}

        {/* ── LEGS ── */}
        {sitting ? (
          // sitting: thighs forward, shins dangling, feet swinging happily
          <g>
            <path d="M43 74 l-6 12 M57 74 l6 12" stroke="var(--czk-line)" strokeWidth="8" strokeLinecap="round" />
            <path d="M43 74 l-6 12 M57 74 l6 12" stroke="url(#czkLimb)" strokeWidth="6" strokeLinecap="round" />
            <g className="czk-sit-feet" style={{ transformOrigin: "37px 86px" }}>
              <path d="M37 86 l-1 10" stroke="var(--czk-line)" strokeWidth="8" strokeLinecap="round" />
              <path d="M37 86 l-1 10" stroke="url(#czkLimb)" strokeWidth="6" strokeLinecap="round" />
              <path d="M31 96 q-3 4.5 1.5 5.5 l7 0 q2.8 -0.5 1.8 -3.8 l-0.8 -3 q-4.5 -1.8 -9.5 1.3" fill="url(#czkRed)" stroke="var(--czk-line)" strokeWidth="1.3" />
            </g>
            <g className="czk-sit-feet" style={{ transformOrigin: "63px 86px", animationDelay: "0.8s" }}>
              <path d="M63 86 l1 10" stroke="var(--czk-line)" strokeWidth="8" strokeLinecap="round" />
              <path d="M63 86 l1 10" stroke="url(#czkLimb)" strokeWidth="6" strokeLinecap="round" />
              <path d="M69 96 q3 4.5 -1.5 5.5 l-7 0 q-2.8 -0.5 -1.8 -3.8 l0.8 -3 q4.5 -1.8 9.5 1.3" fill="url(#czkRed)" stroke="var(--czk-line)" strokeWidth="1.3" />
            </g>
          </g>
        ) : (
          <g className={s === "walk" ? "czk-legs" : undefined} style={{ transformOrigin: "50px 78px" }}>
            <path d="M43 76 l-1.5 18 M57 76 l1.5 18" stroke="var(--czk-line)" strokeWidth="8" strokeLinecap="round" />
            <path d="M43 76 l-1.5 18 M57 76 l1.5 18" stroke="url(#czkLimb)" strokeWidth="6" strokeLinecap="round" />
            <g>
              <path d="M36 96 q-3.5 5 1.5 6 l8 0 q3 -0.5 2 -4 l-1 -3.5 q-5 -2 -10.5 1.5" fill="url(#czkRed)" stroke="var(--czk-line)" strokeWidth="1.3" />
              <path d="M37 101.5 l9.5 0" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" opacity="0.85" />
              <path d="M64 96 q3.5 5 -1.5 6 l-8 0 q-3 -0.5 -2 -4 l1 -3.5 q5 -2 10.5 1.5" fill="url(#czkRed)" stroke="var(--czk-line)" strokeWidth="1.3" />
              <path d="M63 101.5 l-9.5 0" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" opacity="0.85" />
            </g>
          </g>
        )}

        {/* ── BODY: dungarees ── */}
        <g>
          <path d="M34 54 q16 -8 32 0 l3.5 24 q-19.5 9 -39 0 Z" fill="url(#czkBoard)" stroke="var(--czk-line)" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M41 54 l1.5 9.5 q7.5 3 15 0 l1.5 -9.5" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.3" />
          <path d="M39.5 53 l2.5 9 M60.5 53 l-2.5 9" stroke="#f1f5f9" strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="42.5" cy="63" r="1.7" fill="#fde68a" stroke="var(--czk-line)" strokeWidth="0.7" />
          <circle cx="57.5" cy="63" r="1.7" fill="#fde68a" stroke="var(--czk-line)" strokeWidth="0.7" />
          <rect x="43" y="66" width="14" height="9" rx="2" fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.55)" strokeWidth="1.1" />
          <rect x="45.5" y="62.5" width="2.4" height="6" rx="1.2" fill="#ffffff" />
          <rect x="49.2" y="62" width="2.4" height="6.5" rx="1.2" fill="#93c5fd" />
          <rect x="52.9" y="62.8" width="2.4" height="5.7" rx="1.2" fill="#fca5a5" />
          <ellipse cx="40" cy="72" rx="3" ry="1.6" fill="rgba(255,255,255,0.22)" />
          <ellipse cx="60.5" cy="69" rx="2.4" ry="1.3" fill="rgba(255,255,255,0.18)" />
          {s === "clap" && <path className="czk-facecoat" d="M36 57 q14 -6 28 0 l2.5 19 q-16.5 7 -33 0 Z" fill="rgba(255,255,255,0)" />}
        </g>

        {/* ── ARMS per scene ── */}
        {(() => {
          const arm = (d: string, hand?: [number, number], cls?: string, origin?: string) => (
            <g className={cls} style={origin ? { transformOrigin: origin } : undefined}>
              <path d={d} fill="none" stroke="var(--czk-line)" strokeWidth="7" strokeLinecap="round" />
              <path d={d} fill="none" stroke="url(#czkLimb)" strokeWidth="5" strokeLinecap="round" />
              {hand && <circle cx={hand[0]} cy={hand[1]} r="3.4" fill="url(#czkLimb)" stroke="var(--czk-line)" strokeWidth="1.2" />}
            </g>
          );
          if (s === "juggle")
            return (<>{arm("M36 60 q-8 -6 -6 -14", [30, 46], "czk-arm-l", "36px 60px")}{arm("M64 60 q8 -6 6 -14", [70, 46], "czk-arm-r", "64px 60px")}</>);
          if (s === "clap")
            return (
              <>
                <g className="czk-clap-l" style={{ transformOrigin: "36px 60px" }}>
                  {arm("M36 60 q-10 2 -12 8")}
                  <rect x="19" y="63.5" width="10" height="6" rx="1.5" fill="#8b5a2b" stroke="var(--czk-line)" strokeWidth="1" />
                  <rect x="19.8" y="67.2" width="8.4" height="2" rx="1" fill="#ffffff" opacity="0.9" />
                </g>
                <g className="czk-clap-r" style={{ transformOrigin: "64px 60px" }}>
                  {arm("M64 60 q10 2 12 8")}
                  <rect x="71" y="63.5" width="10" height="6" rx="1.5" fill="#8b5a2b" stroke="var(--czk-line)" strokeWidth="1" />
                  <rect x="71.8" y="67.2" width="8.4" height="2" rx="1" fill="#ffffff" opacity="0.9" />
                </g>
              </>
            );
          if (s === "eat")
            return (
              <>
                {arm("M36 60 q-8 4 -8 10", [28, 70])}
                {/* right arm lifts a chalk stick to his mouth; the stick shrinks bite by bite */}
                <g className="czk-eat-arm" style={{ transformOrigin: "64px 58px" }}>
                  {arm("M64 58 q10 -4 10 -12", [74, 46])}
                  <g className="czk-chalk-bite" style={{ transformOrigin: "74px 44px" }}>
                    <rect x="69" y="41.5" width="11" height="4" rx="2" fill="#ffffff" stroke="var(--czk-line)" strokeWidth="0.9" />
                  </g>
                </g>
              </>
            );
          if (s === "cough")
            return (<>{arm("M36 60 q-8 4 -8 10", [28, 70])}{arm("M64 58 q4 -8 -4 -12", [60, 46])}</>);
          if (s === "sneeze")
            return (<>{arm("M36 60 q-8 4 -8 10", [28, 70])}{arm("M64 58 q6 -8 -2 -13", [62, 45])}</>);
          if (s === "sit")
            return (<>{arm("M36 58 q-6 8 -1 14", [35, 72])}{arm("M64 58 q6 8 1 14", [65, 72])}</>);
          if (s === "write")
            return (<>{arm("M36 60 q-8 4 -8 10", [28, 70])}{arm("M64 58 q8 -8 12 -16", [76, 42], "czk-write-arm", "64px 58px")}</>);
          if (s === "wave" || poked)
            return (<>{arm("M36 60 q-8 4 -8 10", [28, 70])}{arm("M64 58 q10 -8 8 -18", [72, 40], "czm-wave-arm", "64px 58px")}</>);
          if (s === "think")
            return (<>{arm("M36 60 q-8 4 -8 10", [28, 70])}{arm("M64 58 q6 -6 -6 -12", [58, 46])}</>);
          return (<>{arm("M36 60 q-8 4 -8 12", [28, 72])}{arm("M64 60 q8 4 8 12", [72, 72])}</>);
        })()}

        {/* ── HEAD ── */}
        <g className={s === "walk" ? "czk-strut" : undefined}>
          <circle cx="50" cy="37" r="19.5" fill="url(#czkSkin)" stroke="var(--czk-line)" strokeWidth="1.7" />
          <circle cx="50" cy="37" r="19.5" fill="#ffffff" filter="url(#czkGrain)" opacity="0.5" />
          <ellipse cx="42" cy="45" rx="6" ry="3.4" fill="rgba(148,163,184,0.28)" />
          <ellipse cx="58" cy="45" rx="6" ry="3.4" fill="rgba(148,163,184,0.28)" />
          {s === "clap" && <circle className="czk-facecoat" cx="50" cy="37" r="17.5" fill="rgba(255,255,255,0)" />}

          {/* cap */}
          <path d="M30.5 26 q19.5 -17 39 0 l-1.2 4.2 q-18.3 -9 -36.6 0 Z" fill="url(#czkRed)" stroke="var(--czk-line)" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M35 19.5 q8 -5.5 15 -5.8" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="2" strokeLinecap="round" />
          <path d="M27.5 28.5 q22.5 -8.5 45 0 l-1 3 q-21.5 -7.5 -43 0 Z" fill="#991b1b" stroke="var(--czk-line)" strokeWidth="1.2" strokeLinejoin="round" />
          <rect x="45.2" y="18.2" width="9.6" height="4" rx="2" fill="#ffffff" stroke="#7f1d1d" strokeWidth="0.9" transform="rotate(-14 50 20)" />

          {/* eyes */}
          {s === "cough" || s === "sneeze" ? (
            // squeezed-shut eyes
            <g>
              <path d="M39 35 q4 3 8 0" fill="none" stroke="var(--czk-line)" strokeWidth="1.9" strokeLinecap="round" />
              <path d="M53 35 q4 3 8 0" fill="none" stroke="var(--czk-line)" strokeWidth="1.9" strokeLinecap="round" />
            </g>
          ) : (
            <g className="czm-blink" style={{ transformOrigin: "50px 36px" }}>
              <ellipse cx="43" cy="36" rx="4.6" ry="5.6" fill="#ffffff" stroke="var(--czk-line)" strokeWidth="1.1" />
              <ellipse cx="57" cy="36" rx="4.6" ry="5.6" fill="#ffffff" stroke="var(--czk-line)" strokeWidth="1.1" />
              <circle cx={43 + pupil.x} cy={36.6 + pupil.y} r="2.5" fill="#1e293b" />
              <circle cx={57 + pupil.x} cy={36.6 + pupil.y} r="2.5" fill="#1e293b" />
              <circle cx={44 + pupil.x} cy={35.4 + pupil.y} r="0.9" fill="#ffffff" />
              <circle cx={58 + pupil.x} cy={35.4 + pupil.y} r="0.9" fill="#ffffff" />
              <circle cx={42.2 + pupil.x} cy={37.6 + pupil.y} r="0.45" fill="#ffffff" opacity="0.8" />
              <circle cx={56.2 + pupil.x} cy={37.6 + pupil.y} r="0.45" fill="#ffffff" opacity="0.8" />
            </g>
          )}
          {/* brows */}
          <path d="M39 29.5 q4 -2.2 8 -0.6" fill="none" stroke="var(--czk-line)" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M53 28.9 q4 -1.6 8 0.6" fill="none" stroke="var(--czk-line)" strokeWidth="1.5" strokeLinecap="round" />

          {/* nose + blush */}
          <circle cx="50" cy="42" r="2.7" fill="url(#czkLimb)" stroke="var(--czk-line)" strokeWidth="1.1" />
          <circle cx="49.2" cy="41.2" r="0.8" fill="#ffffff" />
          <circle cx="37.5" cy="42.5" r="2.2" fill="#fda4af" opacity="0.45" />
          <circle cx="62.5" cy="42.5" r="2.2" fill="#fda4af" opacity="0.45" />

          {/* ── MOUTH & special faces ── */}
          {s === "eat" && (
            <>
              {/* phase 1: happy munching — puffed cheeks + chewing jaw */}
              <g className="czk-munch-face">
                <ellipse cx="41" cy="45" rx="3.4" ry="2.6" fill="rgba(203,213,225,0.55)" />
                <ellipse cx="59" cy="45" rx="3.4" ry="2.6" fill="rgba(203,213,225,0.55)" />
                <g className="czk-jaw">
                  <path d="M45.5 47.5 q4.5 3 9 0" fill="none" stroke="var(--czk-line)" strokeWidth="1.9" strokeLinecap="round" />
                </g>
              </g>
              {/* phase 2: instant regret — green tinge, wavy grimace, tongue out */}
              <g className="czk-regret-face">
                <circle cx="50" cy="39" r="16" fill="rgba(134,239,172,0.18)" />
                <path d="M38.5 30.5 q4 1.6 7.5 0.2 M54 30.7 q4 -1.4 7.5 -0.2" fill="none" stroke="var(--czk-line)" strokeWidth="1.6" strokeLinecap="round" />
                <path d="M43.5 48 q3.2 -2.4 6.5 0 q3.2 2.4 6.5 0" fill="none" stroke="var(--czk-line)" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M47 49 q3 5.5 6 0 q-1.2 4 -3 4 t-3 -4 Z" fill="#f87171" stroke="var(--czk-line)" strokeWidth="0.8" />
              </g>
            </>
          )}
          {s === "cough" && (
            <ellipse cx="50" cy="48.5" rx="3.4" ry="2.6" fill="#7f1d1d" stroke="var(--czk-line)" strokeWidth="1" />
          )}
          {s === "sneeze" && (
            <path d="M45 48.5 q5 3.5 10 0" fill="none" stroke="var(--czk-line)" strokeWidth="1.9" strokeLinecap="round" />
          )}
          {!customFace && (
            s === "think" ? (
              <path d="M45.5 48.5 q4.5 -1.8 9 0" fill="none" stroke="var(--czk-line)" strokeWidth="1.7" strokeLinecap="round" />
            ) : poked || s === "juggle" || s === "clap" || s === "sit" ? (
              <g>
                <path d="M43.5 47 q6.5 7.5 13 0 q-6.5 3.5 -13 0 Z" fill="#7f1d1d" stroke="var(--czk-line)" strokeWidth="1" strokeLinejoin="round" />
                <path d="M46.5 50.3 q3.5 2.6 7 0 q-1.4 2.6 -3.5 2.6 t-3.5 -2.6 Z" fill="#f87171" />
              </g>
            ) : (
              <path d="M44 47 q6 4.6 12 0" fill="none" stroke="var(--czk-line)" strokeWidth="1.9" strokeLinecap="round" />
            )
          )}
        </g>
        </g>

        {/* Body-shaped hit area — the ONLY interactive part of the mascot */}
        <ellipse
          cx="50" cy="58" rx="24" ry="50"
          fill="transparent"
          style={{ pointerEvents: "auto", cursor: "pointer" }}
          onClick={poke}
          onMouseEnter={onHover}
        />
      </svg>
    </div>
  );
}
