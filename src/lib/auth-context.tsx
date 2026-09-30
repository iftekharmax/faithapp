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
const MAX_SESSION_DURATION_MS = 10 * 60 * 60 * 1000; // 10 hours
const SESSION_START_KEY = "auth_session_start_time";
const AUTH_INITIALIZATION_TIMEOUT_MS = 10000; // 10 seconds hard timeout for auth initialization

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
  const sessionLimitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializationTimeoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hadSessionRef = useRef(false);
  const mountedRef = useRef(false);
  const loadingUserDataRef = useRef<string | null>(null);
  const initializationPromiseRef = useRef<Promise<void> | null>(null);

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
      
      // Only update if permissions actually changed
      setPermissions(prev => {
        if (JSON.stringify(prev) === JSON.stringify(uniquePerms)) return prev;
        return uniquePerms;
      });
      
      setPermissionsReady(true);
      console.log("[Auth] Permissions loaded:", uniquePerms.length);
    } catch (err) {
      console.error("[Auth] Fatal error loading permissions:", err);
      // Ensure we don't stay in a loading state forever
      setPermissionsReady(true);
    }
  };

  const loadUserData = async (uid: string) => {
    // If we're already loading data for this user, don't start again
    if (loadingUserDataRef.current === uid) return;
    loadingUserDataRef.current = uid;

    try {
      const [profResult, rolesResult] = await Promise.all([
        fetchWithRetry(
          async () => {
            const { data, error } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
            if (error) throw error;
            return data;
          },
          "Profile"
        ),
        fetchWithRetry(
          async () => {
            const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", uid);
            if (error) throw error;
            return data;
          },
          "Roles"
        )
      ]);

      if (mountedRef.current) {
        setProfile((profResult as Profile) ?? null);
        const userRoles = ((rolesResult as { role: AppRole }[]) ?? []).map((x) => x.role);
        setRoles(userRoles);
        setRolesReady(true);
        
        console.log("[Auth] User data loaded for:", uid, "Roles:", userRoles);
        
        // Chain permissions loading
        await loadPermissions(userRoles);
      }
    } catch (err: any) {
      console.error("[Auth] Fatal error loading user data:", err);
      if (mountedRef.current) {
        if (err.status === 401 || err.status === 403) {
          // Only force re-check if we really don't have a session
          const { data } = await supabase.auth.getSession();
          if (!data.session) setAuthReady(false);
        }
        // Ensure we don't stay in a loading state forever
        setRolesReady(true);
        setPermissionsReady(true);
      }
    } finally {
      loadingUserDataRef.current = null;
    }
  };

  const refresh = async () => {
    if (session?.user) await loadUserData(session.user.id);
  };

  const clearTimers = useCallback(() => {
    if (refreshTimer.current) {
      clearTimeout(refreshTimer.current);
      refreshTimer.current = null;
    }
    if (sessionLimitTimer.current) {
      clearTimeout(sessionLimitTimer.current);
      sessionLimitTimer.current = null;
    }
  }, []);

  const signOut = useCallback(async () => {
    console.log("[Auth] Signing out...");
    hadSessionRef.current = false;
    setSessionExpired(false);
    localStorage.removeItem(SESSION_START_KEY);
    clearTimers();
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("[Auth] Sign out error:", err);
    }
  }, [clearTimers]);

  const handleSessionLimit = useCallback(() => {
    const startTimeStr = localStorage.getItem(SESSION_START_KEY);
    if (!startTimeStr) {
      const now = Date.now().toString();
      localStorage.setItem(SESSION_START_KEY, now);
      return now;
    }
    
    const startTime = parseInt(startTimeStr, 10);
    const elapsed = Date.now() - startTime;
    
    if (elapsed >= MAX_SESSION_DURATION_MS) {
      console.warn("[Auth] Session exceeded 10 hour limit. Signing out.");
      void signOut();
      return null;
    }
    
    return startTimeStr;
  }, [signOut]);

  const scheduleProactiveRefresh = useCallback((s: Session | null) => {
    if (refreshTimer.current) {
      clearTimeout(refreshTimer.current);
      refreshTimer.current = null;
    }

    if (!s?.expires_at) return;
    
    const startTimeStr = handleSessionLimit();
    if (!startTimeStr) return;
    
    const startTime = parseInt(startTimeStr, 10);
    const remainingSessionTime = MAX_SESSION_DURATION_MS - (Date.now() - startTime);
    
    if (sessionLimitTimer.current) clearTimeout(sessionLimitTimer.current);
    sessionLimitTimer.current = setTimeout(() => {
      console.warn("[Auth] Session limit reached (10h).");
      void signOut();
    }, remainingSessionTime);

    const expiresAtMs = s.expires_at * 1000;
    const delay = Math.max(5_000, expiresAtMs - Date.now() - REFRESH_BUFFER_MS);
    
    console.log(`[Auth] Scheduling token refresh in ${Math.round(delay/1000)}s`);
    
    refreshTimer.current = setTimeout(async () => {
      console.log("[Auth] Proactively refreshing token...");
      const { data, error } = await supabase.auth.refreshSession();
      if (error || !data.session) {
        console.error("[Auth] Token refresh failed:", error?.message);
        setSessionExpired(true);
        void signOut();
      }
    }, delay);
  }, [handleSessionLimit, signOut]);

  useEffect(() => {
    mountedRef.current = true;

    const startInitializationTimeout = () => {
      if (initializationTimeoutTimer.current) clearTimeout(initializationTimeoutTimer.current);
      initializationTimeoutTimer.current = setTimeout(() => {
        if (!mountedRef.current) return;
        if (loading) {
          console.warn("[Auth] Initialization timeout reached. Forcing loading=false.");
          setLoading(false);
          if (!hadSessionRef.current) setSessionTimedOut(true);
        }
      }, AUTH_INITIALIZATION_TIMEOUT_MS);
    };

    const clearInitializationTimeout = () => {
      if (initializationTimeoutTimer.current) {
        clearTimeout(initializationTimeoutTimer.current);
        initializationTimeoutTimer.current = null;
      }
    };

    startInitializationTimeout();

    const initialize = async () => {
      // Prevent duplicate initialization
      if (initializationPromiseRef.current) return initializationPromiseRef.current;

      initializationPromiseRef.current = (async () => {
        try {
          console.log("[Auth] Starting session initialization...");
          const { data, error } = await supabase.auth.getSession();
          
          if (!mountedRef.current) return;
          if (error) {
            console.error("[Auth] Initial session fetch error:", error);
            // Don't throw, just log and continue to resolve loading state
          }
          
          const s = data?.session ?? null;
          if (s) {
            // Check if we need to set/restore session start time
            if (!localStorage.getItem(SESSION_START_KEY)) {
              localStorage.setItem(SESSION_START_KEY, Date.now().toString());
            }
            setSession(s);
            setAuthReady(true);
            hadSessionRef.current = true;
            scheduleProactiveRefresh(s);
            
            // Load secondary data (profile, roles)
            // Note: loadUserData already has its own retry logic and loading state protection
            await loadUserData(s.user.id);
          } else {
            console.log("[Auth] No active session found.");
            setSession(null);
            setAuthReady(true); // DEFINITIVE: We checked, and there is NO session.
            setRolesReady(true);
            setPermissionsReady(true);
            hadSessionRef.current = false;
          }
        } catch (err) {
          console.error("[Auth] Fatal error during initialization:", err);
          if (mountedRef.current) {
            setAuthReady(true);
            setRolesReady(true);
            setPermissionsReady(true);
          }
        } finally {
          if (mountedRef.current) {
            clearInitializationTimeout();
            setLoading(false);
            console.log("[Auth] Initialization complete.");
          }
          initializationPromiseRef.current = null;
        }
      })();

      return initializationPromiseRef.current;
    };

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, s) => {
      if (!mountedRef.current) return;
      console.log("[Auth] Event:", event);

      if (event === "TOKEN_REFRESHED") {
        if (s) {
          setSession(s);
          scheduleProactiveRefresh(s);
        }
        return;
      }

      if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        if (s) {
          // New login sets a new 10-hour window
          if (event === "SIGNED_IN" && !hadSessionRef.current) {
             localStorage.setItem(SESSION_START_KEY, Date.now().toString());
          }
          
          setSession(prev => {
            if (prev?.user?.id === s?.user?.id && prev?.access_token === s?.access_token) {
              return prev;
            }
            return s;
          });

          if (s.user) {
            // If already loading data for this user, let it finish
            if (loadingUserDataRef.current === s.user.id) return;

            setAuthReady(true);
            hadSessionRef.current = true;
            void loadUserData(s.user.id).finally(() => {
              if (mountedRef.current) setLoading(false);
            });
          }
          scheduleProactiveRefresh(s);
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
        clearTimers();
        clearInitializationTimeout();
        setLoading(false);
        localStorage.removeItem(SESSION_START_KEY);
      }
    });

    // Start initialization
    void initialize();

    return () => {
      mountedRef.current = false;
      clearInitializationTimeout();
      clearTimers();
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
    signOut,
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
