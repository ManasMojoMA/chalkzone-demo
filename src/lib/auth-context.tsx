"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { type User, type Role } from "@prisma/client";
import { createBrowserClient } from "@supabase/ssr";
import { getCurrentPrismaUser, signOut as serverSignOut } from "@/app/login/actions";
import { useRouter } from "next/navigation";

// Expose these generic types for compatibility with previous code
export type UserRole = Role;
export type DevUser = User;

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loadUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  // Which Supabase uid the current `user` belongs to. Supabase fires
  // SIGNED_IN / TOKEN_REFRESHED every time the tab regains focus — refetching
  // (and especially re-entering the loading state) on those events remounts
  // the whole dashboard and closes any open drawer/dialog. Only reload when
  // the uid actually changes; only show the loading screen on first boot.
  const loadedUid = useRef<string | null>(null);
  const booted = useRef(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const loadUser = useCallback(async () => {
    if (!booted.current) setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        const dbUser = await getCurrentPrismaUser();
        loadedUid.current = session.user.id;
        setUser(dbUser);
      } else {
        loadedUid.current = null;
        setUser(null);
      }
    } catch (error) {
      console.error("Failed to load user:", error);
    } finally {
      if (!booted.current) {
        booted.current = true;
        setIsLoading(false);
      }
    }
  }, [supabase]);

  useEffect(() => {
    // Initial load
    loadUser();

    // Listen to Supabase auth events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        loadedUid.current = null;
        setUser(null);
        return;
      }
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        // Ignore focus-triggered re-emissions for the same signed-in user
        if (session?.user?.id && session.user.id === loadedUid.current) return;
        loadUser();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadUser, supabase.auth]);

  const logout = useCallback(async () => {
    await serverSignOut();
    loadedUid.current = null;
    setUser(null);
    router.push("/login");
  }, [router]);

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: !!user, isLoading, loadUser, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
