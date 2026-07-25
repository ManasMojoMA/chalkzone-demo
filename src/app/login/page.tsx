"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { PasswordInput } from "@/components/password-input";
import { Loader2, ArrowRight, Sparkles, GraduationCap, ShieldCheck } from "lucide-react";
import { AnimatedLogo } from "@/components/animated-logo";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const router = useRouter();
  const { loadUser } = useAuth();
  const { setTheme } = useTheme();

  // The login screen is always light — a previous user's dark preference
  // must not leak onto a shared device. Each account restores its own
  // theme right after sign-in (see ThemeSync).
  useEffect(() => { setTheme("light"); }, [setTheme]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [audience, setAudience] = useState<"student" | "staff">("student");

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.session) {
        // Remember-me: when OFF we set a session-scoped marker cookie plus a
        // persistent flag. If the flag survives a browser restart without the
        // marker, the middleware force-signs-out. When ON, clear both.
        if (rememberMe) {
          document.cookie = "cz-eph=; path=/; max-age=0";
          document.cookie = "cz-eph-flag=; path=/; max-age=0";
        } else {
          document.cookie = "cz-eph=1; path=/"; // dies with the browser session
          document.cookie = "cz-eph-flag=1; path=/; max-age=2592000";
        }

        // Navigate immediately; the profile loads in the background while the
        // dashboard shows its skeleton (was: await → visibly slower login)
        toast.success("Successfully logged in!");
        router.push("/dashboard");
        loadUser();
      }
    } catch (error: unknown) {
      // Deliberately generic: naming which field was wrong (email vs.
      // password) tells an attacker which addresses have accounts here at
      // all — the same reason Google/GitHub/every real login page keep this
      // message vague. We just make the guidance clearer without leaking that.
      const raw = error instanceof Error ? error.message : "";
      const message = /invalid login credentials/i.test(raw)
        ? "That email and password don't match our records. Double-check both and try again, or use Forgot password? below."
        : raw || "Failed to log in";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col overflow-x-hidden selection:bg-primary/20">
      {/* Decorative Background Elements (same language as the landing page) */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#ED1B24_1px,transparent_1px)] [background-size:16px_16px]" />
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-to-br from-[#FBB03B]/20 to-[#ED1B24]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gradient-to-tr from-[#0071BC]/10 to-transparent rounded-full blur-3xl translate-y-1/3 -translate-x-1/4" />
      </div>

      {/* Header */}
      <header className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-900/10"><div className="container mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/">
          <AnimatedLogo size="md" />
        </Link>
      </div></header>

      {/* Login Card */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 pt-[92px] pb-20">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-accent-foreground font-medium text-sm mb-6 border border-accent/40">
              <Sparkles className="h-4 w-4 text-accent" />
              Empowering Possibilities at Your Institution
            </div>
            {audience === "student" ? (
              <>
                <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase leading-[0.95] mb-3">
                  Back to the <span className="text-primary">Board</span>
                </h1>
                <p className="text-slate-600 font-medium">
                  Student sign-in — classes, careers and everything between.
                </p>
              </>
            ) : (
              <>
                <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase leading-[0.95] mb-3">
                  Staff <span className="text-secondary">Portal</span>
                </h1>
                <p className="text-slate-600 font-medium">
                  Faculty, administration & HR sign-in.
                </p>
              </>
            )}
          </div>

          {/* Audience switcher — two clearly separate login areas */}
          <div className="grid grid-cols-2 mb-4 rounded-xl border-2 border-slate-900 overflow-hidden bg-white shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
            {([
              { key: "student", label: "Student Login", icon: <GraduationCap className="h-4 w-4" aria-hidden /> },
              { key: "staff", label: "Faculty & Admin", icon: <ShieldCheck className="h-4 w-4" aria-hidden /> },
            ] as const).map((t, i) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setAudience(t.key)}
                aria-pressed={audience === t.key}
                className={
                  "inline-flex items-center justify-center gap-1.5 py-2.5 text-xs font-black uppercase tracking-wide transition-colors " +
                  (i > 0 ? "border-l-2 border-slate-900 " : "") +
                  (audience === t.key
                    ? t.key === "student" ? "bg-primary text-white" : "bg-secondary text-white"
                    : "hover:bg-muted text-slate-700")
                }
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          <div className={`p-8 rounded-2xl bg-white border-4 border-slate-900 shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] border-t-8 ${audience === "student" ? "border-t-primary" : "border-t-secondary"}`}>
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="font-bold uppercase text-xs tracking-wide text-slate-700">
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@university.edu"
                  className="h-12 border-2 border-slate-900 rounded-lg font-medium focus-visible:ring-primary focus-visible:ring-offset-2"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="font-bold uppercase text-xs tracking-wide text-slate-700">
                    Password
                  </Label>
                  <Link href="/reset-password" className="text-xs font-semibold text-primary hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <PasswordInput
                  id="password"
                  placeholder="••••••••"
                  className="h-12 border-2 border-slate-900 rounded-lg font-medium focus-visible:ring-primary focus-visible:ring-offset-2"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <Checkbox checked={rememberMe} onCheckedChange={(c) => setRememberMe(!!c)} />
                <span className="text-xs font-semibold text-slate-700">Keep me logged in on this device</span>
              </label>
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 text-base font-bold bg-primary hover:bg-primary/90 text-white border-2 border-slate-900 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] transition-all"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Enter the Zone
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>
            </form>
          </div>

          <p className="mt-6 text-center text-sm text-slate-500 font-medium">
            Access is provisioned by the university. Trouble signing in? Contact the admin office.
          </p>
        </div>
      </main>
    </div>
  );
}
