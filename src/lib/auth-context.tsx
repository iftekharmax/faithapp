import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, type AppRole } from "./supabase";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  loading: boolean;
  sessionTimedOut: boolean;
  emailVerified: boolean;
  sessionExpired: boolean;
  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (roles: AppRole[]) => boolean;
  refresh: () => Promise<void>;
  retrySession: () => void;
  signOut: () => Promise<void>;
  dismissSessionExpired: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Refresh token this many ms before expiry (safety buffer).
const REFRESH_BUFFER_MS = 60_000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionTimedOut, setSessionTimedOut] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const [sessionExpired, setSessionExpired] = useState(false);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hadSessionRef = useRef(false);

  const loadUserData = async (uid: string) => {
    const [{ data: prof }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
    ]);
    setProfile((prof as Profile) ?? null);
    setRoles(((r as { role: AppRole }[]) ?? []).map((x) => x.role));
  };

  const refresh = async () => {
    if (session?.user) await loadUserData(session.user.id);
  };

  const clearRefreshTimer = () => {
    if (refreshTimer.current) {
      clearTimeout(refreshTimer.current);
      refreshTimer.current = null;
    }
  };

  const scheduleProactiveRefresh = useCallback((s: Session | null) => {
    clearRefreshTimer();
    if (!s?.expires_at) return;
    const expiresAtMs = s.expires_at * 1000;
    const delay = Math.max(5_000, expiresAtMs - Date.now() - REFRESH_BUFFER_MS);
    refreshTimer.current = setTimeout(async () => {
      const { data, error } = await supabase.auth.refreshSession();
      if (error || !data.session) {
        // Refresh failed — token likely revoked/expired. Show re-login prompt.
        setSessionExpired(true);
        await supabase.auth.signOut().catch(() => {});
      }
    }, delay);
  }, []);

  useEffect(() => {
    let mounted = true;

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (!mounted) return;

      // Silent token rotation — keep session/refresh timer in sync but don't
      // treat as identity change (avoids UI redirects while user is active).
      if (event === "TOKEN_REFRESHED") {
        if (s) {
          setSession(s);
          scheduleProactiveRefresh(s);
        }
        return;
      }

      // Only react to real identity transitions. Ignore INITIAL_SESSION
      // (handled by getSession below) and other noisy events.
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") {
        return;
      }

      setSession(s);
      scheduleProactiveRefresh(s);

      if (s?.user) {
        hadSessionRef.current = true;
        setTimeout(() => {
          void loadUserData(s.user.id);
        }, 0);
      } else {
        setProfile(null);
        setRoles([]);
      }
    });

    // Safety net: never keep the app in the loading state forever if
    // getSession() hangs (network glitch, blocked request, etc.).
    setSessionTimedOut(false);
    const loadingSafety = setTimeout(() => {
      if (!mounted) return;
      setLoading(false);
      if (!hadSessionRef.current) setSessionTimedOut(true);
    }, 4000);

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      scheduleProactiveRefresh(data.session);
      if (data.session?.user) {
        hadSessionRef.current = true;
        setSessionTimedOut(false);
        void loadUserData(data.session.user.id).finally(() => {
          clearTimeout(loadingSafety);
          setLoading(false);
        });
      } else {
        clearTimeout(loadingSafety);
        setSessionTimedOut(false);
        setLoading(false);
      }
    }).catch(() => {
      if (!mounted) return;
      clearTimeout(loadingSafety);
      setLoading(false);
      setSessionTimedOut(true);
    });

    return () => {
      mounted = false;
      clearTimeout(loadingSafety);
      clearRefreshTimer();
      sub.subscription.unsubscribe();
    };
  }, [scheduleProactiveRefresh, retryTick]);


  const emailVerified = Boolean(session?.user?.email_confirmed_at ?? session?.user?.confirmed_at);

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    profile,
    roles,
    loading,
    sessionTimedOut,
    emailVerified,
    sessionExpired,
    hasRole: (r) => roles.includes(r),
    hasAnyRole: (rs) => rs.some((r) => roles.includes(r)),
    refresh,
    retrySession: () => {
      setLoading(true);
      setSessionTimedOut(false);
      setRetryTick((n) => n + 1);
    },
    signOut: async () => {
      hadSessionRef.current = false;
      setSessionExpired(false);
      await supabase.auth.signOut();
    },
    dismissSessionExpired: () => setSessionExpired(false),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  counselor: "Counselor",
  application_team: "Application Team",
  student: "Student",
};

/** Landing route for a given role after login. */
export function getRoleHome(roles: AppRole[]): string {
  if (roles.includes("admin")) return "/dashboard";
  if (roles.includes("counselor")) return "/dashboard";
  if (roles.includes("application_team")) return "/applications";
  if (roles.includes("student")) return "/applications";
  return "/dashboard";
}
