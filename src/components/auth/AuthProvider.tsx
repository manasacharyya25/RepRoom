"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  isSignedIn: boolean;
  /** True after the first local session read (or auth event). */
  authReady: boolean;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return value;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const applySession = useCallback((next: Session | null) => {
    setSession(next);
    setUser(next?.user ?? null);
    setAuthReady(true);
  }, []);

  const refreshUser = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user: nextUser }
    } = await supabase.auth.getUser();
    if (nextUser) {
      setUser(nextUser);
      setAuthReady(true);
      return;
    }
    applySession(null);
  }, [applySession]);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    // Option 1: optimistic local session (fast).
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      applySession(data.session);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      applySession(nextSession);
    });

    // Background confirmation against Auth server (non-blocking).
    void supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      if (data.user) {
        setUser(data.user);
        setAuthReady(true);
        return;
      }
      applySession(null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [applySession]);

  const value = useMemo(
    () => ({
      user,
      session,
      isSignedIn: Boolean(user),
      authReady,
      refreshUser
    }),
    [user, session, authReady, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
