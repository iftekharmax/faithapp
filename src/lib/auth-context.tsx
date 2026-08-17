import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, type AppRole } from "./supabase";
import { listPermissions, type RolePermission } from "./user-management";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  department?: string | null;
  status?: string;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  permissions: string[];
  loading: boolean;
  authReady: boolean;
  rolesReady: boolean;
  permissionsReady: boolean;
  sessionTimedOut: boolean;
  emailVerified: boolean;
  sessionExpired: boolean;
  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (roles: AppRole[]) => boolean;
  hasPermission: (permission: string) => boolean;
  refresh: () => Promise<void>;
  retrySession: () => void;
  signOut: () => Promise<void>;
  dismissSessionExpired: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const REFRESH_BUFFER_MS = 60_000;
const RETRY_COUNT = 3;
const RETRY_DELAYS = [500, 1000, 2000];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Readiness states for Route Guards
  const [authReady, setAuthReady] = useState(false);
  const [rolesReady, setRolesReady] = useState(false);
  const [permissionsReady, setPermissionsReady] = useState(false);
  
  const [sessionTimedOut, setSessionTimedOut] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const [sessionExpired, setSessionExpired] = useState(false);
  
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hadSessionRef = useRef(false);

  // Global Permissions Cache
  const cachedPermissionsRef = useRef<RolePermission[] | null>(null);

  const fetchWithRetry = async <T,>(fn: () => Promise<T>, label: string): Promise<T> => {
    let lastError: any;
    for (let i = 0; i < RETRY_COUNT; i++) {
      try {
        console.log(`[Auth] Loading ${label} (attempt ${i + 1})...`);
        return await fn();
      } catch (err: any) {
        lastError = err;
        // Do not retry 401/403
        if (err.status === 401 || err.status === 403 || err.code === 'PGRST301') {
          throw err;
        }
        console.warn(`[Auth] ${label} failed (attempt ${i + 1}):`, err.message);
        if (i < RETRY_COUNT - 1) {
          await new Promise(res => setTimeout(res, RETRY_DELAYS[i]));
        }
      }
    }
    throw lastError;
  };

  const loadPermissions = async (userRoles: AppRole[]) => {
    try {
      if (!cachedPermissionsRef.current) {
        cachedPermissionsRef.current = await fetchWithRetry(() => listPermissions(), "Permissions");
      }
      
      const roleSet = new Set(userRoles);
      const perms = cachedPermissionsRef.current
        .filter(p => roleSet.has(p.role))
        .map(p => p.permission);
      
      const uniquePerms = Array.from(new Set(perms));
      setPermissions(uniquePerms);
      setPermissionsReady(true);
      console.log("[Auth] Permissions loaded:", uniquePerms.length);
    } catch (err) {
      console.error("[Auth] Fatal error loading permissions:", err);
      // We don't set permissionsReady here so the UI can show retrying
    }
  };

  const loadUserData = async (uid: string) => {
    setRolesReady(false);
    setPermissionsReady(false);
    
    try {
      const [profResult, rolesResult] = await Promise.all([
        fetchWithRetry(
          () => supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
          "Profile"
        ),
        fetchWithRetry(
          () => supabase.from("user_roles").select("role").eq("user_id", uid),
          "Roles"
        )
      ]);

      if (profResult.error) throw profResult.error;
      if (rolesResult.error) throw rolesResult.error;

      setProfile((profResult.data as Profile) ?? null);
      const userRoles = ((rolesResult.data as { role: AppRole }[]) ?? []).map((x) => x.role);
      setRoles(userRoles);
      setRolesReady(true);
      
      console.log("[Auth] User data loaded for:", uid, "Roles:", userRoles);
      
      // Chain permissions loading
      await loadPermissions(userRoles);
    } catch (err: any) {
      console.error("[Auth] Fatal error loading user data:", err);
      // If it's a 401/403, we might be in a race or really unauthorized
      if (err.status === 401 || err.status === 403) {
        setAuthReady(false); // Force re-check
      }
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
    
    console.log(`[Auth] Scheduling token refresh in ${Math.round(delay/1000)}s`);
    
    refreshTimer.current = setTimeout(async () => {
      console.log("[Auth] Proactively refreshing token...");
      const { data, error } = await supabase.auth.refreshSession();
      if (error || !data.session) {
        console.error("[Auth] Token refresh failed:", error?.message);
        setSessionExpired(true);
        await supabase.auth.signOut().catch(() => {});
      }
    }, delay);
  }, []);

  useEffect(() => {
    let mounted = true;

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (!mounted) return;
      console.log("[Auth] Event:", event);

      if (event === "TOKEN_REFRESHED") {
        if (s) {
          setSession(s);
          scheduleProactiveRefresh(s);
        }
        return;
      }

      if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        setSession(s);
        setAuthReady(!!s);
        scheduleProactiveRefresh(s);

        if (s?.user) {
          hadSessionRef.current = true;
          void loadUserData(s.user.id);
        }
      } else if (event === "SIGNED_OUT") {
        setSession(null);
        setProfile(null);
        setRoles([]);
        setPermissions([]);
        setAuthReady(false);
        setRolesReady(false);
        setPermissionsReady(false);
        cachedPermissionsRef.current = null;
        hadSessionRef.current = false;
        clearRefreshTimer();
      }
    });

    const loadingSafety = setTimeout(() => {
      if (!mounted) return;
      if (loading) {
        console.warn("[Auth] Loading safety timeout reached");
        setLoading(false);
        if (!hadSessionRef.current) setSessionTimedOut(true);
      }
    }, 15000);

    // Initial session check
    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) console.error("[Auth] Initial session error:", error);
      
      const s = data.session;
      setSession(s);
      setAuthReady(!!s);
      scheduleProactiveRefresh(s);
      
      if (s?.user) {
        hadSessionRef.current = true;
        setSessionTimedOut(false);
        void loadUserData(s.user.id).finally(() => {
          if (mounted) {
            clearTimeout(loadingSafety);
            setLoading(false);
          }
        });
      } else {
        clearTimeout(loadingSafety);
        setSessionTimedOut(false);
        setLoading(false);
      }
    }).catch((err) => {
      if (!mounted) return;
      console.error("[Auth] Fatal session catch:", err);
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
    permissions,
    loading,
    authReady,
    rolesReady,
    permissionsReady,
    sessionTimedOut,
    emailVerified,
    sessionExpired,
    hasRole: (r) => roles.includes(r),
    hasAnyRole: (rs) => rs.some((r) => roles.includes(r)),
    hasPermission: (p) => permissions.includes(p) || roles.includes('admin'),
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

export function getRoleHome(roles: AppRole[]): string {
  if (roles.includes("admin")) return "/dashboard";
  if (roles.includes("counselor")) return "/dashboard";
  if (roles.includes("application_team")) return "/applications";
  if (roles.includes("student")) return "/applications";
  return "/dashboard";
}
