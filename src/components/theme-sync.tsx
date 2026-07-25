"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { useAuth } from "@/lib/auth-context";

/**
 * Scopes the theme to the signed-in account. next-themes persists one global
 * value per device, which leaked one user's dark mode into the next login on
 * a shared laptop. This restores each user's own preference when they sign
 * in — and a user with no saved preference always starts in light mode.
 */
export function ThemeSync() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const syncedFor = useRef<string | null>(null);

  // When the signed-in user changes, apply THEIR stored preference.
  useEffect(() => {
    if (!user) { syncedFor.current = null; return; }
    if (syncedFor.current === user.id) return;
    syncedFor.current = user.id;
    setTheme(localStorage.getItem(`cz-theme-${user.id}`) ?? "light");
  }, [user, setTheme]);

  // Persist toggle changes under the user's own key.
  useEffect(() => {
    if (!user || syncedFor.current !== user.id || !theme) return;
    localStorage.setItem(`cz-theme-${user.id}`, theme);
  }, [theme, user]);

  return null;
}
