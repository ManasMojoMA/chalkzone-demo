import { cn } from "@/lib/utils";

/**
 * ChalkZone animated logo — chalkboard icon with a self-drawing chalk
 * scribble, a letter-by-letter "handwritten" wordmark, and an eraser sweep,
 * looping every 4s. Pure CSS/SVG (keyframes live in globals.css under the
 * `cz-` prefix). Static fallback under prefers-reduced-motion.
 */

type LogoSize = "sm" | "md" | "lg";

const SIZES: Record<
  LogoSize,
  { icon: number; word: string; tag: string; gap: string; radius: string }
> = {
  sm: { icon: 32, word: "text-lg", tag: "text-[9px]", gap: "gap-2", radius: "rounded-lg" },
  md: { icon: 40, word: "text-2xl", tag: "text-[10px]", gap: "gap-2.5", radius: "rounded-xl" },
  lg: { icon: 56, word: "text-4xl", tag: "text-xs", gap: "gap-3", radius: "rounded-2xl" },
};

const LETTERS: { ch: string; cls: string }[] = [
  ...["C", "h", "a", "l", "k"].map((ch) => ({ ch, cls: "text-foreground" })),
  ...["Z", "o", "n", "e"].map((ch) => ({ ch, cls: "text-primary" })),
];

const LETTER_STAGGER = 0.115; // seconds between letters (write and erase sweep)

export function AnimatedLogo({
  size = "md",
  showTagline = true,
  className,
}: {
  size?: LogoSize;
  showTagline?: boolean;
  className?: string;
}) {
  const s = SIZES[size];
  const detailed = size !== "sm"; // simpler scribble at navbar size

  return (
    <span
      role="img"
      aria-label="ChalkZone - School of Business"
      className={cn("inline-flex items-center", s.gap, className)}
    >
      {/* Board icon — red brand frame, slate-green board, self-drawing chalk */}
      <span
        aria-hidden
        className={cn(
          "shrink-0 bg-primary border-2 border-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] flex items-center justify-center",
          s.radius
        )}
        style={{ width: s.icon, height: s.icon }}
      >
        <svg
          viewBox="0 0 48 48"
          width={s.icon * 0.82}
          height={s.icon * 0.82}
          fill="none"
        >
          {/* board face */}
          <rect x="7" y="9" width="34" height="27" rx="4" fill="#35564e" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" />
          {/* chalk tray */}
          <rect x="12" y="37.5" width="24" height="2.6" rx="1.3" fill="rgba(255,255,255,0.45)" />
          {/* animated chalk scribble (wobbly, hand-drawn) */}
          <path
            className="cz-scribble"
            d="M12 18 q5 -4.5 11 -0.5 t13 -0.5"
            stroke="rgba(255,255,255,0.92)"
            strokeWidth="2.4"
            strokeLinecap="round"
            pathLength={100}
          />
          {detailed && (
            <path
              className="cz-scribble"
              d="M12 27 q7 4.5 14 0.8 q5 -2.5 10 0.8"
              stroke="rgba(255,255,255,0.78)"
              strokeWidth="2.1"
              strokeLinecap="round"
              pathLength={100}
              style={{ animationDelay: "0.35s" }}
            />
          )}
          {/* chalk-dust flecks */}
          {detailed && (
            <>
              <circle className="cz-dust" cx="30" cy="22" r="0.9" fill="rgba(255,255,255,0.8)" />
              <circle className="cz-dust" cx="19" cy="31" r="0.7" fill="rgba(255,255,255,0.7)" style={{ animationDelay: "0.5s" }} />
            </>
          )}
        </svg>
      </span>

      {/* Wordmark + tagline */}
      <span className="flex flex-col leading-none min-w-0">
        <span
          aria-hidden
          className={cn(
            "relative font-heading font-black tracking-tighter uppercase whitespace-nowrap",
            s.word
          )}
        >
          {LETTERS.map((l, i) => (
            <span
              key={i}
              className={cn("cz-letter", l.cls)}
              style={{ animationDelay: `${i * LETTER_STAGGER}s` }}
            >
              {l.ch}
            </span>
          ))}
          {/* eraser/duster sweep */}
          <span
            aria-hidden
            className="cz-eraser absolute top-1/2 -translate-y-1/2 h-[0.72em] w-[0.55em] rounded-[0.12em] bg-slate-800 border-b-[0.16em] border-slate-300 -rotate-[10deg] shadow-[0_0_10px_4px_rgba(255,255,255,0.5)] pointer-events-none"
            style={{ left: "-14%", opacity: 0 }}
          />
        </span>
        {showTagline && (
          <span
            aria-hidden
            className={cn(
              "font-semibold text-muted-foreground tracking-wide mt-1",
              s.tag
            )}
          >
            School of Business
          </span>
        )}
      </span>
    </span>
  );
}

export default AnimatedLogo;
