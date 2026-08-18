import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  title: string;
  message: string | null;
  read: boolean;
  created_at: string;
}

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(15);
    setItems((data as Notification[]) ?? []);
  };

  useEffect(() => {
    void load();
    if (!user) return;
    // React may mount, clean up, and immediately remount effects in development.
    // A removed Supabase channel can remain in the client's registry briefly, so
    // reusing the same topic can return an already-subscribed channel and `.on()`
    // will throw. Give every effect instance its own topic instead.
    const subscriptionId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const ch = supabase
      .channel(`notif:${user.id}:${subscriptionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => { void load(); },
      )
      .subscribe();
    const t = setInterval(() => { void load(); }, 60_000);
    return () => {
      clearInterval(t);
      void supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const unread = items.filter((n) => !n.read).length;

  const markAll = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleNotificationClick = async (n: Notification) => {
    // 1. Mark as read in DB if unread
    if (!n.read) {
      await supabase.from("notifications").update({ read: true }).eq("id", n.id);
      setItems((prev) => prev.map((item) => (item.id === n.id ? { ...item, read: true } : item)));
    }

    // 2. Determine target URL
    const fullText = `${n.title} ${n.message || ""}`;
    const appMatch = fullText.match(/APP-\d{4}-\d+/);
    
    let targetUrl: string | null = null;
    
    if (appMatch) {
      // Find application UUID by its code
      const { data: appData } = await supabase
        .from("applications")
        .select("id")
        .eq("application_code", appMatch[0])
        .maybeSingle();
      
      if (appData) {
        targetUrl = `/applications/${appData.id}`;
      } else {
        // Fallback to searching if we can't find the UUID
        targetUrl = `/applications?q=${appMatch[0]}`;
      }
    } else if (fullText.toLowerCase().includes("task") || fullText.toLowerCase().includes("approval")) {
      targetUrl = "/tasks";
    }

    // 3. Navigate and close popover
    if (targetUrl) {
      setOpen(false);
      void navigate({ to: targetUrl as any });
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 shadow-xl">
        <div className="flex items-center justify-between border-b p-3 bg-muted/20">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Notifications</span>
            {unread > 0 && <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 border-none">{unread} new</Badge>}
          </div>
          <Button variant="ghost" size="sm" onClick={markAll} disabled={unread === 0} className="text-xs h-7">
            Mark all read
          </Button>
        </div>
        <ScrollArea className="max-h-[400px]">
          {items.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No notifications yet</div>
          ) : (
            <ul className="divide-y divide-muted/50">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => handleNotificationClick(n)}
                    className={cn(
                      "flex w-full items-start gap-3 p-4 text-left transition-all hover:bg-accent/50",
                      !n.read && "bg-primary/5"
                    )}
                  >
                    {!n.read && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary ring-4 ring-primary/10" />
                    )}
                    <div className={cn("min-w-0 flex-1", n.read ? "opacity-70" : "")}>
                      <p className="text-[13px] font-semibold leading-snug text-foreground">
                        {n.title}
                      </p>
                      {n.message && (
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {n.message}
                        </p>
                      )}
                      <p className="mt-2 text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
