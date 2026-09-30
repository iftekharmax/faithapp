import { MessageSquare } from "lucide-react";
import { useChat } from "./ChatProvider";
import { cn } from "@/lib/utils";

export function FloatingChatButton() {
  const { open, toggle, totalUnread } = useChat();
  if (open) return null;
  return (
    <button
      onClick={toggle}
      aria-label="Open chat"
      className={cn(
        "fixed bottom-4 right-4 z-40 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105",
        "sm:bottom-6 sm:right-6"
      )}
    >
      <MessageSquare className="h-6 w-6" />
      {totalUnread > 0 && (
        <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-destructive px-1 text-[11px] font-semibold text-destructive-foreground shadow">
          {totalUnread > 9 ? "9+" : totalUnread}
        </span>
      )}
    </button>
  );
}
