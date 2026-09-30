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
      <PopoverContent align="end" className="w-[380px] p-0 shadow-2xl rounded-2xl border-muted/20 overflow-hidden">
        <div className="flex items-center justify-between border-b p-4 bg-background/50 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-foreground">Notifications</span>
            {unread > 0 && (
              <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 border-none px-2 h-5 text-[10px] font-bold uppercase tracking-wider">
                {unread} new
              </Badge>
            )}
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={markAll} 
            disabled={unread === 0} 
            className="text-[11px] h-8 font-semibold hover:bg-primary/5 hover:text-primary transition-colors"
          >
            Mark all read
          </Button>
        </div>
        <ScrollArea className="max-h-[500px]">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-8 text-center">
              <div className="h-12 w-12 rounded-full bg-muted/30 flex items-center justify-center mb-4">
                <Bell className="h-6 w-6 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">No notifications yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">We'll notify you when something important happens.</p>
            </div>
          ) : (
            <ul className="divide-y divide-muted/30">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => handleNotificationClick(n)}
                    className={cn(
                      "flex w-full items-start gap-3.5 p-4 text-left transition-all relative group",
                      !n.read ? "bg-primary/[0.03] hover:bg-primary/[0.06]" : "hover:bg-muted/30"
                    )}
                  >
                    {!n.read && (
                      <span className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                    )}
                    
                    <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted/40 text-muted-foreground group-hover:scale-110 transition-transform">
                      <Bell className={cn("h-4 w-4", !n.read && "text-primary")} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn(
                          "text-[13px] leading-snug truncate",
                          !n.read ? "font-bold text-foreground" : "font-medium text-muted-foreground"
                        )}>
                          {n.title}
                        </p>
                        <span className="shrink-0 text-[10px] font-medium text-muted-foreground/50 mt-0.5">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: false })}
                        </span>
                      </div>
                      
                      {n.message && (
                        <p className={cn(
                          "mt-1 text-[12px] line-clamp-2 leading-normal",
                          !n.read ? "text-muted-foreground font-medium" : "text-muted-foreground/70"
                        )}>
                          {n.message}
                        </p>
                      )}
                      
                      {!n.read && (
                        <div className="mt-2.5 flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                          <span className="text-[10px] font-bold text-primary uppercase tracking-tighter">New Update</span>
                        </div>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
        {items.length > 0 && (
          <div className="p-2 border-t bg-muted/5">
            <Button variant="ghost" size="sm" className="w-full text-xs font-semibold h-8 text-muted-foreground hover:text-foreground">
              View all notifications
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
