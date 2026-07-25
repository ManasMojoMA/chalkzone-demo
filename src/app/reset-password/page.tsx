"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createResetRequestClient } from "@/lib/supabase/reset-request-client";
import { AnimatedLogo } from "@/components/animated-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/password-input";
import { ArrowLeft, ArrowRight, Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";

type Mode = "checking" | "request" | "sent" | "update";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<Mode>("checking");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  // Arriving from the recovery email link, exchange whatever the link carries
  // into a session, then show the "set new password" form. Supabase can send
  // the recovery link in several shapes depending on project/template config:
  //   • PKCE:            /reset-password?code=xxx
  //   • Token-hash OTP:  /reset-password?token_hash=xxx&type=recovery
  //   • Implicit hash:   /reset-password#access_token=…&type=recovery
  // We handle all three rather than relying on auto-detection (which only
  // covers the last one) — that mismatch was dumping users on the request form.
  useEffect(() => {
    let cancelled = false;

    const finish = (m: Mode) => { if (!cancelled) setMode(m); };

    const run = async () => {
      const url = new URL(window.location.href);
      const params = url.searchParams;
      const hash = new URLSearchParams(url.hash.replace(/^#/, ""));

      // An explicit error in the link (expired/used) — send them to request a fresh one.
      const errDesc = params.get("error_description") || hash.get("error_description");
      if (errDesc) {
        toast.error(decodeURIComponent(errDesc));
        return finish("request");
      }

      const code = params.get("code");
      const tokenHash = params.get("token_hash");
      const type = (params.get("type") || hash.get("type")) as "recovery" | null;
      const hasHashToken = !!hash.get("access_token");
      const hasRecoveryParams = !!(code || tokenHash || hasHashToken);

      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            // PKCE links only complete in the browser profile that requested
            // them — Gmail often opens links in a different profile. Explain
            // that in human terms instead of surfacing the SDK's message.
            if (/code verifier/i.test(error.message)) {
              toast.error(
                "This reset link opened in a different browser or profile than the one that requested it. Request a new link below and open it from this same window.",
                { duration: 12000 }
              );
              return finish("request");
            }
            throw error;
          }
        } else if (tokenHash) {
          const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type || "recovery" });
          if (error) throw error;
        } else if (hasHashToken) {
          // detectSessionInUrl handles this; give it a beat to settle.
          await new Promise((r) => setTimeout(r, 500));
        }
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "This reset link is invalid or has expired. Please request a new one.");
        return finish("request");
      }

      // Clean the token noise out of the address bar.
      if (hasRecoveryParams) window.history.replaceState({}, "", url.pathname);

      const { data } = await supabase.auth.getSession();
      if (data.session) return finish("update");
      // No recovery params and no session → this is a plain "forgot password" visit.
      finish(hasRecoveryParams ? "request" : "request");
    };

    run();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") finish("update");
    });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      // Fired from a separate implicit-flow client — see reset-request-client
      // for why: PKCE links only complete in the browser profile that
      // requested them, which broke the moment Gmail opened the link
      // elsewhere. This link works from any browser or device.
      const resetClient = createResetRequestClient();
      const { error } = await resetClient.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setMode("sent");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to send reset email");
    } finally {
      setBusy(false);
    }
  };

  const updatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    if (password !== confirm) return toast.error("Passwords don't match");
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated — welcome back!");
      router.push("/dashboard");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to update password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col overflow-x-hidden selection:bg-primary/20">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#ED1B24_1px,transparent_1px)] [background-size:16px_16px]" />
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-to-br from-[#FBB03B]/20 to-[#ED1B24]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
      </div>

      <header className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-900/10"><div className="container mx-auto px-6 py-4">
        <Link href="/login">
          <AnimatedLogo size="md" />
        </Link>
      </div></header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-4 pt-[92px] pb-20">
        <div className="w-full max-w-md">
          <div className="p-8 rounded-2xl bg-white border-4 border-slate-900 shadow-[8px_8px_0px_0px_rgba(15,23,42,1)]">
            {mode === "checking" && (
              <div className="flex justify-center py-8"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
            )}

            {mode === "request" && (
              <form onSubmit={requestReset} className="space-y-5">
                <div>
                  <h1 className="text-2xl font-black tracking-tighter uppercase">Forgot password?</h1>
                  <p className="text-sm text-slate-600 mt-1">
                    Enter your university email and we&apos;ll send you a reset link.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="font-bold uppercase text-xs tracking-wide text-slate-700">Email Address</Label>
                  <Input
                    id="email" type="email" required placeholder="name@university.edu"
                    className="h-12 border-2 border-slate-900 rounded-lg font-medium"
                    value={email} onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={busy} className="w-full h-12 font-bold border-2 border-slate-900 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition-all">
                  {busy ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                  Send reset link <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Link href="/login" className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-900">
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
                </Link>
              </form>
            )}

            {mode === "sent" && (
              <div className="text-center space-y-4 py-4">
                <MailCheck className="h-12 w-12 text-primary mx-auto" />
                <h1 className="text-xl font-black tracking-tighter uppercase">Check your inbox</h1>
                <p className="text-sm text-slate-600">
                  If an account exists for <b>{email}</b>, a password-reset link is on its way.
                  Open it in this browser to set a new password.
                </p>
                <Link href="/login" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
                </Link>
              </div>
            )}

            {mode === "update" && (
              <form onSubmit={updatePassword} className="space-y-5">
                <div>
                  <h1 className="text-2xl font-black tracking-tighter uppercase">Set a new password</h1>
                  <p className="text-sm text-slate-600 mt-1">Minimum 8 characters.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password" className="font-bold uppercase text-xs tracking-wide text-slate-700">New password</Label>
                  <PasswordInput
                    id="new-password" required placeholder="••••••••"
                    className="h-12 border-2 border-slate-900 rounded-lg font-medium"
                    value={password} onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password" className="font-bold uppercase text-xs tracking-wide text-slate-700">Confirm password</Label>
                  <PasswordInput
                    id="confirm-password" required placeholder="••••••••"
                    className="h-12 border-2 border-slate-900 rounded-lg font-medium"
                    value={confirm} onChange={(e) => setConfirm(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={busy} className="w-full h-12 font-bold border-2 border-slate-900 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition-all">
                  {busy ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                  Update password
                </Button>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
