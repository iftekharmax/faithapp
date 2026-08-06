import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import {
  listMyConversations, upsertMyPresence, markConversationRead,
  type Conversation,
} from "@/lib/chat";

interface ChatContextValue {
  open: boolean;
  setOpen: (v: boolean) => void;
  toggle: () => void;
  activeId: string | null;
  openConversation: (id: string) => void;
  conversations: Conversation[];
  totalUnread: number;
  refreshConversations: () => Promise<void>;
  refreshing: boolean;
  presence: Record<string, { status: string; last_seen_at: string }>;
  mentionsOnly: boolean;
  setMentionsOnly: (v: boolean) => void;
}


const ChatContext = createContext<ChatContextValue | undefined>(undefined);

const MENTIONS_ONLY_KEY = "faithams:chat:mentionsOnly";

function isMentionOfUser(body: string, userId: string | undefined | null, userName?: string | null): boolean {
  if (!body) return false;
  const b = body.toLowerCase();
  if (b.includes("@all") || b.includes("@everyone") || b.includes("@channel") || b.includes("@you") || b.includes("@here")) return true;
  if (userId && b.includes(`@${userId.slice(0, 8).toLowerCase()}`)) return true;
  if (userName) {
    const n = userName.trim().toLowerCase();
    if (n && b.includes(`@${n}`)) return true;
    const first = n.split(/\s+/)[0];
    if (first && b.includes(`@${first}`)) return true;
  }
  return false;
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const [presence, setPresence] = useState<Record<string, { status: string; last_seen_at: string }>>({});
  const [mentionsOnly, setMentionsOnlyState] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try { return window.localStorage.getItem(MENTIONS_ONLY_KEY) === "1"; } catch { return false; }
  });
  const setMentionsOnly = useCallback((v: boolean) => {
    setMentionsOnlyState(v);
    try { window.localStorage.setItem(MENTIONS_ONLY_KEY, v ? "1" : "0"); } catch { /* noop */ }
  }, []);
  const presenceInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const openRef = useRef(open);
  const activeIdRef = useRef(activeId);
  const mentionsOnlyRef = useRef(mentionsOnly);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastSoundRef = useRef<number>(0);
  useEffect(() => { openRef.current = open; }, [open]);
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);
  useEffect(() => { mentionsOnlyRef.current = mentionsOnly; }, [mentionsOnly]);

  function playMessageSound() {
    const now = Date.now();
    if (now - lastSoundRef.current < 800) return;
    lastSoundRef.current = now;
    try {
      const Ctx: typeof AudioContext | undefined =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") { void ctx.resume().catch(() => {}); }
      const t0 = ctx.currentTime;
      const mkBlip = (start: number, freq: number) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(freq, start);
        g.gain.setValueAtTime(0.0001, start);
        g.gain.exponentialRampToValueAtTime(0.15, start + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
        o.connect(g).connect(ctx.destination);
        o.start(start);
        o.stop(start + 0.24);
      };
      mkBlip(t0, 660);
      mkBlip(t0 + 0.09, 990);
    } catch { /* noop */ }
  }

  const refreshConversations = useCallback(async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      const list = await listMyConversations();
      setConversations(list);
    } catch { /* noop */ }
    finally { setRefreshing(false); }
  }, [user]);


  const openConversation = useCallback((id: string) => {
    setActiveId(id);
    setOpen(true);
    // Optimistic: zero unread instantly so the badge drops before the
    // server round-trip completes.
    setConversations((prev) => {
      const idx = prev.findIndex((c) => c.id === id);
      if (idx === -1 || !prev[idx].unread_count) return prev;
      const next = prev.slice();
      next[idx] = { ...next[idx], unread_count: 0, last_read_at: new Date().toISOString() };
      return next;
    });
    void markConversationRead(id).then(refreshConversations);
  }, [refreshConversations]);

  // Ask for browser notification permission once, on first open
  useEffect(() => {
    if (!open) return;
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "default") {
      try { void Notification.requestPermission(); } catch { /* noop */ }
    }
  }, [open]);


  // Load conversations + set presence + subscribe to changes
  useEffect(() => {
    if (!user) {
      setConversations([]);
      setActiveId(null);
      return;
    }
    void refreshConversations();
    void upsertMyPresence("online");
    presenceInterval.current = setInterval(() => { void upsertMyPresence("online"); }, 45_000);

    const onUnload = () => { void upsertMyPresence("offline"); };
    window.addEventListener("beforeunload", onUnload);
    const onVisibility = () => {
      // Don't trigger refreshes on visibility change.
      // void upsertMyPresence(document.hidden ? "away" : "online");
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Global subscription: any new message in a conversation user is part of
    const ch = supabase.channel(`chat-global:${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (p) => {
        const m: any = p.new;
        // Optimistic instant preview update for BOTH own and peer messages so
        // the conversation list re-sorts and the last-message text flips
        // before the refetch resolves. Unread only bumps for peer messages
        // and only when we aren't actively viewing the conversation.
        const viewingThis = activeIdRef.current === m?.conversation_id && openRef.current && !document.hidden;
        if (m) {
          setConversations((prev) => {
            const idx = prev.findIndex((c) => c.id === m.conversation_id);
            if (idx === -1) return prev;
            const next = prev.slice();
            const cur = next[idx];
            const isPeer = m.sender_id !== user.id;
            next[idx] = {
              ...cur,
              last_message_at: m.created_at ?? cur.last_message_at,
              last_message: {
                id: m.id,
                body: m.body ?? null,
                sender_id: m.sender_id ?? null,
                created_at: m.created_at,
                attachments: m.attachments ?? [],
              },
              unread_count: isPeer && !viewingThis
                ? Number(cur.unread_count || 0) + 1
                : (isPeer ? cur.unread_count : 0),
            };
            next.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
            return next;
          });
        }

        void refreshConversations();
        if (!m || m.sender_id === user.id) return;
        if (viewingThis) return;
        const body: string = (m.body ?? "").toString();
        const mentioned = isMentionOfUser(body, user.id, (user as any)?.user_metadata?.full_name ?? null);
        const title = mentioned ? "You were mentioned" : (m.reply_to_id ? "New reply" : "New message");
        const shouldSound = mentioned || !mentionsOnlyRef.current;
        if (shouldSound) playMessageSound();
        // Browser notification (only when relevant to sound preference)
        try {
          if (shouldSound && typeof Notification !== "undefined" && Notification.permission === "granted" && document.hidden) {
            const n = new Notification(title, { body: body.slice(0, 140) || "(attachment)", tag: `msg:${m.conversation_id}` });
            n.onclick = () => { window.focus(); setActiveId(m.conversation_id); setOpen(true); n.close(); };
          }
        } catch { /* noop */ }
        // In-app toast fallback — always show mentions; suppress others in mentions-only mode
        if (shouldSound) {
          void import("sonner").then(({ toast }) => toast.message(title, { description: body.slice(0, 120) || "(attachment)", action: { label: "Open", onClick: () => { setActiveId(m.conversation_id); setOpen(true); } } }));
        }
      })


      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, () => {
        void refreshConversations();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "user_presence" }, (p) => {
        const rec: any = p.new ?? p.old;
        if (rec?.user_id) setPresence((prev) => ({ ...prev, [rec.user_id]: { status: rec.status, last_seen_at: rec.last_seen_at } }));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "conversation_members", filter: `user_id=eq.${user.id}` }, () => {
        void refreshConversations();
      })
      .subscribe();

    // Initial presence snapshot
    supabase.from("user_presence").select("*").then(({ data }) => {
      if (!data) return;
      const map: any = {};
      for (const row of data as any[]) map[row.user_id] = { status: row.status, last_seen_at: row.last_seen_at };
      setPresence(map);
    });

    return () => {
      supabase.removeChannel(ch);
      window.removeEventListener("beforeunload", onUnload);
      document.removeEventListener("visibilitychange", onVisibility);
      if (presenceInterval.current) clearInterval(presenceInterval.current);
      void upsertMyPresence("offline");
    };
  }, [user, refreshConversations]);

  const totalUnread = useMemo(
    () => conversations.reduce((sum, c) => sum + Number(c.unread_count || 0), 0),
    [conversations],
  );

  const value: ChatContextValue = {
    open, setOpen,
    toggle: () => setOpen((v) => !v),
    activeId, openConversation,
    conversations, totalUnread,
    refreshConversations, refreshing,
    presence,
    mentionsOnly, setMentionsOnly,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
}
