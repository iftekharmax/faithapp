import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Palette, Bell, Shield, KeyRound, LogOut, Volume2, Mail, Sun, Moon, Monitor,
  Sparkles, Loader2, Save, Undo2,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import {
  getUndoDurationMs, setUndoDurationMs,
  UNDO_MIN_MS, UNDO_MAX_MS, UNDO_DEFAULT_MS,
} from "@/lib/undo-prefs";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings · Faith AMS" },
      { name: "description", content: "Manage your Faith AMS workspace preferences, appearance, and notifications." },
    ],
  }),
  component: SettingsPage,
});

interface QuietHours { enabled: boolean; start: string; end: string }
interface NotifPrefs {
  email: boolean;
  inApp: boolean;
  sound: boolean;
  taskReminders: boolean;
  taskReminderEmail: boolean;
  quietHours: QuietHours;
}
const DEFAULT_QUIET: QuietHours = { enabled: false, start: "22:00", end: "07:00" };
const DEFAULT_PREFS: NotifPrefs = {
  email: true, inApp: true, sound: true,
  taskReminders: true, taskReminderEmail: false,
  quietHours: DEFAULT_QUIET,
};

function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { user, signOut } = useAuth();
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [density, setDensity] = useState<"comfortable" | "compact">(
    () => (typeof window !== "undefined" && (localStorage.getItem("faith.density") as "comfortable" | "compact")) || "comfortable"
  );
  const [undoMs, setUndoMs] = useState<number>(() => getUndoDurationMs());

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("notification_prefs").eq("id", user.id).maybeSingle();
      const raw = (data as { notification_prefs?: Partial<NotifPrefs> } | null)?.notification_prefs ?? {};
      setPrefs({
        ...DEFAULT_PREFS,
        ...raw,
        quietHours: { ...DEFAULT_QUIET, ...(raw.quietHours ?? {}) },
      });
      setLoading(false);
    })();
  }, [user?.id]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.density = density;
    localStorage.setItem("faith.density", density);
  }, [density]);

  useEffect(() => { setUndoDurationMs(undoMs); }, [undoMs]);

  const savePrefs = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles")
      .update({ notification_prefs: prefs }).eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Preferences saved");
  };

  const themes: { key: "light" | "dark" | "system"; label: string; Icon: typeof Sun }[] = [
    { key: "light", label: "Light", Icon: Sun },
    { key: "dark", label: "Dark", Icon: Moon },
    { key: "system", label: "System", Icon: Monitor },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-card to-card p-5 shadow-sm sm:p-6">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-primary to-fuchsia-500 text-white shadow-md">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
            <p className="text-sm text-muted-foreground">Workspace preferences and account settings</p>
          </div>
        </div>
      </div>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary"><Palette className="h-4 w-4" /></div>
            <div>
              <CardTitle className="text-base">Appearance</CardTitle>
              <CardDescription>Theme and interface density</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <Label className="mb-2 block text-sm">Theme</Label>
            <div className="grid grid-cols-3 gap-2 sm:max-w-md">
              {themes.map(({ key, label, Icon }) => {
                const active = theme === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTheme(key)}
                    className={cn(
                      "group relative flex flex-col items-center gap-1.5 rounded-xl border-2 bg-card p-3 transition",
                      active ? "border-primary ring-2 ring-primary/20 shadow-sm" : "border-border hover:border-primary/50",
                    )}
                  >
                    <div className={cn(
                      "grid h-9 w-9 place-items-center rounded-lg transition",
                      active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:text-foreground",
                    )}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className={cn("text-xs font-semibold", active ? "text-foreground" : "text-muted-foreground")}>
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <Separator />

          <div>
            <Label className="mb-2 block text-sm">Density</Label>
            <div className="grid grid-cols-2 gap-2 sm:max-w-md">
              {(["comfortable", "compact"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDensity(d)}
                  className={cn(
                    "rounded-xl border-2 p-3 text-sm font-medium capitalize transition",
                    density === d ? "border-primary ring-2 ring-primary/20 bg-primary/5" : "border-border hover:border-primary/50",
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary"><Bell className="h-4 w-4" /></div>
            <div>
              <CardTitle className="text-base">Notifications</CardTitle>
              <CardDescription>How you want to be notified</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</div>
          ) : (
            <>
              <PrefRow icon={Bell} title="In-app notifications" desc="Show alerts in the notification bell" checked={prefs.inApp} onChange={(v) => setPrefs((p) => ({ ...p, inApp: v }))} />
              <PrefRow icon={Mail} title="Email notifications" desc="Receive important updates by email" checked={prefs.email} onChange={(v) => setPrefs((p) => ({ ...p, email: v }))} />
              <PrefRow icon={Volume2} title="Notification sound" desc="Play a sound for new messages" checked={prefs.sound} onChange={(v) => setPrefs((p) => ({ ...p, sound: v }))} />

              <Separator />
              <div>
                <p className="mb-2 text-sm font-semibold">Task due-date reminders</p>
                <div className="space-y-3">
                  <PrefRow icon={Bell} title="Remind me before tasks are due" desc="Send an in-app notification when a task is approaching its due date" checked={prefs.taskReminders} onChange={(v) => setPrefs((p) => ({ ...p, taskReminders: v }))} />
                  <PrefRow icon={Mail} title="Also email me task reminders" desc="Send the same reminder to your email address" checked={prefs.taskReminderEmail} onChange={(v) => setPrefs((p) => ({ ...p, taskReminderEmail: v }))} />
                </div>
              </div>

              <Separator />
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Quiet hours</p>
                    <p className="text-xs text-muted-foreground">Pause reminders during this window (uses your timezone)</p>
                  </div>
                  <Switch
                    checked={prefs.quietHours.enabled}
                    onCheckedChange={(v) => setPrefs((p) => ({ ...p, quietHours: { ...p.quietHours, enabled: v } }))}
                    aria-label="Enable quiet hours"
                  />
                </div>
                {prefs.quietHours.enabled && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="quiet-start">Start</Label>
                      <input
                        id="quiet-start"
                        type="time"
                        value={prefs.quietHours.start}
                        onChange={(e) => setPrefs((p) => ({ ...p, quietHours: { ...p.quietHours, start: e.target.value } }))}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="quiet-end">End</Label>
                      <input
                        id="quiet-end"
                        type="time"
                        value={prefs.quietHours.end}
                        onChange={(e) => setPrefs((p) => ({ ...p, quietHours: { ...p.quietHours, end: e.target.value } }))}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2">
                <Button onClick={savePrefs} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save preferences
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Undo behaviour */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary"><Undo2 className="h-4 w-4" /></div>
            <div>
              <CardTitle className="text-base">Undo behaviour</CardTitle>
              <CardDescription>How long the Undo option stays on screen after a task status change</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="undo-duration" className="text-sm">Undo timeout</Label>
            <div className="flex items-center gap-2">
              <span className="tabular-nums text-sm font-semibold">{(undoMs / 1000).toFixed(0)}s</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setUndoMs(UNDO_DEFAULT_MS)}
                disabled={undoMs === UNDO_DEFAULT_MS}
              >
                Reset
              </Button>
            </div>
          </div>
          <input
            id="undo-duration"
            type="range"
            min={UNDO_MIN_MS}
            max={UNDO_MAX_MS}
            step={1000}
            value={undoMs}
            onChange={(e) => setUndoMs(Number(e.target.value))}
            aria-label="Undo timeout in seconds"
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>{UNDO_MIN_MS / 1000}s</span>
            <span>Default {UNDO_DEFAULT_MS / 1000}s</span>
            <span>{UNDO_MAX_MS / 1000}s</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Applies to task status changes (drag-and-drop, dropdown) and application status quick actions. Longer timeouts give you more time to revert; shorter ones dismiss faster.
          </p>
        </CardContent>
      </Card>


      {/* Security */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary"><Shield className="h-4 w-4" /></div>
            <div>
              <CardTitle className="text-base">Security</CardTitle>
              <CardDescription>Password and session controls</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          <Button variant="outline" asChild className="justify-start">
            <Link to="/change-password"><KeyRound className="mr-2 h-4 w-4" />Change password</Link>
          </Button>
          <Button
            variant="outline"
            className="justify-start text-destructive hover:text-destructive"
            onClick={async () => { await signOut(); toast.success("Signed out"); }}
          >
            <LogOut className="mr-2 h-4 w-4" />Sign out
          </Button>
        </CardContent>
      </Card>

      {/* Account */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
          <CardDescription>Your account details</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Email</p>
            <p className="font-medium">{user?.email}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">User ID</p>
            <p className="truncate font-mono text-xs">{user?.id}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PrefRow({
  icon: Icon, title, desc, checked, onChange,
}: {
  icon: typeof Bell; title: string; desc: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border bg-card/40 p-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
