import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { formatDistanceToNow } from "date-fns";

interface ActivityItem {
  id: string;
  action: string;
  entity: string | null;
  created_at: string;
}

export function ActivityFeed() {
  const { user } = useAuth();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("activities")
        .select("id, action, entity, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (!cancelled) {
        setItems((data as ActivityItem[]) ?? []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4" /> Activity Feed
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[320px]">
          {loading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
          ) : items.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No activity yet. Actions you take will appear here.
            </div>
          ) : (
            <ul className="divide-y">
              {items.map((it) => (
                <li key={it.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-tight">
                      <span className="font-medium">{it.action}</span>
                      {it.entity && <span className="text-muted-foreground"> · {it.entity}</span>}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {formatDistanceToNow(new Date(it.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
