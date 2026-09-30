import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChat } from "./ChatProvider";
import { cn } from "@/lib/utils";

export function HeaderChatButton() {
  const { toggle, totalUnread } = useChat();
  return (
    <Button variant="ghost" size="icon" onClick={toggle} className="relative" aria-label="Open chat">
      <MessageSquare className="h-4 w-4" />
      {totalUnread > 0 && (
        <span className={cn("absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground",
          "animate-pulse")}>
          {totalUnread > 9 ? "9+" : totalUnread}
        </span>
      )}
      <span className="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
    </Button>
  );
}
