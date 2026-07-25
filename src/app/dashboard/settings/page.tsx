"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/password-input";
import { KeyRound, Loader2, Footprints } from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
  const { user } = useAuth();
  const supabase = createClient();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    if (password !== confirm) return toast.error("Passwords don't match");
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password changed successfully");
      setPassword("");
      setConfirm("");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to change password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-black tracking-tighter uppercase">Account Settings</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Signed in as <span className="font-semibold text-foreground">{user.email}</span> · {user.role}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4 text-primary" /> Change password
          </CardTitle>
          <CardDescription>Pick something at least 8 characters long that you don&apos;t use elsewhere.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={changePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <PasswordInput
                id="new-password" required placeholder="••••••••"
                value={password} onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <PasswordInput
                id="confirm-password" required placeholder="••••••••"
                value={confirm} onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Update password
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2 text-base">
            <Footprints className="h-4 w-4 text-primary" /> Platform walkthrough
          </CardTitle>
          <CardDescription>Replay Chalkie&apos;s guided tour of every section.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => { localStorage.setItem("cz-tour-force", "1"); window.location.href = "/dashboard"; }}>
            Replay the tour
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
