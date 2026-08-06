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
  loading: boolean; // session loading
  rolesLoading: boolean; // profile/roles loading
  rolesLoadError: string | null;
  sessionTimedOut: boolean;
  emailVerified: boolean;
  sessionExpired: boolean;
  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (roles: AppRole[]) => boolean;
  refresh: () => Promise<void>;
  retrySession: () => void;
  reloadUserData: () => Promise<void>;
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
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesLoadError, setRolesLoadError] = useState<string | null>(null);
  const [sessionTimedOut, setSessionTimedOut] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const [sessionExpired, setSessionExpired] = useState(false);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hadSessionRef = useRef(false);

  const retryAsync = async <T,>(
    fn: () => Promise<T>,
    maxAttempts = 3,
    backoff = [500, 1000, 2000]
  ): Promise<T> => {
    let lastErr: any;
    for (let i = 0; i < maxAttempts; i++) {
      try {
        return await fn();
      } catch (err: any) {
        lastErr = err;
        const status = err?.status || err?.code;
        if (status === 401 || status === 403 || status === 404 || (typeof status === 'string' && status.startsWith('4'))) {
          throw err;
        }
        if (i < maxAttempts - 1) {
          await new Promise((r) => setTimeout(r, backoff[i] || 1000));
        }
      }
    }
    throw lastErr;
  };

  const loadUserData = async (uid: string) => {
    setRolesLoading(true);
    setRolesLoadError(null);
    try {
      await retryAsync(async () => {
        const [{ data: prof, error: pErr }, { data: r, error: rErr }] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
          supabase.from("user_roles").select("role").eq("user_id", uid),
        ]);
        
        if (pErr) throw pErr;
        if (rErr) throw rErr;

        setProfile((prof as Profile) ?? null);
        setRoles(((r as { role: AppRole }[]) ?? []).map((x) => x.role));
      });
    } catch (err: any) {
      console.error("Error loading user data after retries:", err);
      setRolesLoadError(err.message || "Failed to load user profile and roles");
    } finally {
      setRolesLoading(false);
    }
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
        setSessionExpired(true);
        await supabase.auth.signOut().catch(() => {});
      }
    }, delay);
  }, []);

  useEffect(() => {
    let mounted = true;

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (!mounted) return;

      // Only respond to events that indicate a real session state change
      if (
        event === "SIGNED_IN" || 
        event === "SIGNED_OUT" || 
        event === "USER_UPDATED" || 
        event === "TOKEN_REFRESHED"
      ) {
        setSession(s);
        scheduleProactiveRefresh(s);

        if (s?.user) {
          hadSessionRef.current = true;
          void loadUserData(s.user.id);
        } else {
          setProfile(null);
          setRoles([]);
        }
      }
    });

    setSessionTimedOut(false);
    
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      
      const currentSession = data.session;
      setSession(currentSession);
      scheduleProactiveRefresh(currentSession);
      
      if (currentSession?.user) {
        hadSessionRef.current = true;
        setSessionTimedOut(false);
        // Load data if we don't have it yet
        if (roles.length === 0) {
          void loadUserData(currentSession.user.id).finally(() => {
            if (mounted) setLoading(false);
          });
        } else {
          setLoading(false);
        }
      } else {
        setSessionTimedOut(false);
        setLoading(false);
      }
    }).catch(() => {
      if (!mounted) return;
      setLoading(false);
      setSessionTimedOut(true);
    });

    return () => {
      mounted = false;
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
    rolesLoading,
    rolesLoadError,
    sessionTimedOut,
    emailVerified,
    sessionExpired,
    hasRole: (r) => roles.includes(r),
    hasAnyRole: (rs) => rs.some((r) => roles.includes(r)),
    refresh,
    reloadUserData: async () => {
      if (session?.user) await loadUserData(session.user.id);
    },
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
