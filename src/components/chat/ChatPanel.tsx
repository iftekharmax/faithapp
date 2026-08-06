import { Link } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  MessageSquare, X, Search, Plus, Send, Paperclip, Smile, Reply, Edit3, Trash2, Copy,
  Pin, Star, MoreHorizontal, Users, ChevronLeft, Info, Check, CheckCheck, Loader2, FileText, Image as ImageIcon,
  Forward, ChevronUp, ChevronDown, Film, Download, PinOff, Bell, BellOff, AtSign,
} from "lucide-react";
import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns";
import { useChat } from "./ChatProvider";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import {
  listMessages, sendMessage as sendMsg, editMessage, deleteMessage, togglePin, toggleStar,
  reactToMessage, listReactions, uploadAttachment, listChatPeople, getOrCreateDirect,
  createGroup, markConversationRead, searchAll, hideConversation, unhideConversation,
  type Message, type Attachment, type DirectoryPerson, type GlobalSearchHit,
} from "@/lib/chat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Dialog as UIDialog, DialogContent as UIDialogContent, DialogHeader as UIDialogHeader, DialogTitle as UIDialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { linkifyText } from "@/lib/linkify";
import { cn } from "@/lib/utils";

const EMOJIS = ["👍","❤️","😂","😮","😢","🎉","🙏","🔥","✅","👏","💯","🚀"];

type PendingUpload = {
  id: string;
  file: File;
  previewUrl?: string;
  progress: number; // 0-100
  status: "uploading" | "done" | "error";
  att?: Attachment;
  error?: string;
};

function initials(name?: string | null, email?: string | null) {
  const s = (name || email || "?").trim();
  const parts = s.split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || s[0].toUpperCase();
}

function dateLabel(d: Date) {
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "MMM d, yyyy");
}

export function ChatPanel() {
  const { open, setOpen, activeId, openConversation, conversations, refreshConversations, refreshing, presence, mentionsOnly, setMentionsOnly } = useChat();
  const { user, roles } = useAuth();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"all"|"group"|"people">("all");
  const [messages, setMessages] = useState<Message[]>([]);
  const [reactions, setReactions] = useState<any[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [reply, setReply] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [showInfo, setShowInfo] = useState(false);
  const [showMobileList, setShowMobileList] = useState(true);
  const [newDialog, setNewDialog] = useState(false);
  const [directory, setDirectory] = useState<DirectoryPerson[]>([]);
  const [people, setPeople] = useState<DirectoryPerson[]>([]);
  const [peoplePage, setPeoplePage] = useState(0);
  const [peopleHasMore, setPeopleHasMore] = useState(true);
  const [searchHits, setSearchHits] = useState<GlobalSearchHit[]>([]);
  const [searchPage, setSearchPage] = useState(0);
  const [searchHasMore, setSearchHasMore] = useState(false);
  const [searching, setSearching] = useState(false);
  const [groupTitle, setGroupTitle] = useState("");
  const [groupMode, setGroupMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [dirSearch, setDirSearch] = useState("");
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [forwarding, setForwarding] = useState<Message | null>(null);
  const [threadSearchOpen, setThreadSearchOpen] = useState(false);
  const [threadQuery, setThreadQuery] = useState("");
  const [threadHitIdx, setThreadHitIdx] = useState(0);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [memberReads, setMemberReads] = useState<Record<string, string>>({});
  const [lightbox, setLightbox] = useState<{ items: { url: string; name: string; type: string }[]; index: number } | null>(null);
  const [showPinned, setShowPinned] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingChannelRef = useRef<any>(null);
  const typingTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const lastTypingSentRef = useRef<number>(0);
  const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const peopleStripRef = useRef<HTMLDivElement>(null);
  const convListScrollRef = useRef<HTMLDivElement>(null);
  const convListRef = useRef<HTMLUListElement>(null);
  // Persist per-conversation thread scroll positions across switches.
  const threadScrollRef = useRef<Record<string, number>>({});
  const prevActiveIdRef = useRef<string | null>(null);

  function getThreadViewport(): HTMLElement | null {
    const el = scrollRef.current as unknown as HTMLElement | null;
    if (!el) return null;
    return (el.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null) ?? el;
  }
  function getListViewport(): HTMLElement | null {
    const el = convListScrollRef.current;
    if (!el) return null;
    return (el.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null) ?? el;
  }



  function scrollToMessage(id: string) {
    const el = document.getElementById(`msg-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightId(id);
    setTimeout(() => setHighlightId((cur) => (cur === id ? null : cur)), 1600);
  }

  async function retryUpload(id: string) {
    const item = pending.find((p) => p.id === id);
    if (!item || !activeId) return;
    setPending((prev) => prev.map((p) => p.id === id ? { ...p, status: "uploading", progress: 5, error: undefined } : p));
    const timer = setInterval(() => {
      setPending((prev) => prev.map((p) => p.id === id && p.status === "uploading" && p.progress < 90
        ? { ...p, progress: Math.min(90, p.progress + 8 + Math.random() * 8) } : p));
    }, 220);
    try {
      const att = await uploadAttachment(activeId, item.file);
      clearInterval(timer);
      setPending((prev) => prev.map((p) => p.id === id ? { ...p, status: "done", progress: 100, att } : p));
    } catch (err: any) {
      clearInterval(timer);
      setPending((prev) => prev.map((p) => p.id === id ? { ...p, status: "error", error: err.message ?? "Upload failed" } : p));
      toast.error(err.message ?? "Upload failed");
    }
  }

  const active = conversations.find((c) => c.id === activeId) ?? null;



  useEffect(() => {
    if (!activeId || !user) return;
    let cancelled = false;
    setLoadingMsgs(true);

    async function loadMemberReads() {
      const { data } = await supabase.from("conversation_members")
        .select("user_id, last_read_at").eq("conversation_id", activeId!);
      if (cancelled || !data) return;
      const map: Record<string, string> = {};
      for (const r of data as any[]) if (r.last_read_at) map[r.user_id] = r.last_read_at;
      setMemberReads(map);
    }

    async function reload() {
      try {
        const ms = await listMessages(activeId!);
        if (cancelled) return;
        setMessages(ms);
        const rx = await listReactions(ms.map((m) => m.id));
        if (cancelled) return;
        setReactions(rx);
        void loadMemberReads();
        void markConversationRead(activeId!).then(refreshConversations);
      } catch { /* noop */ }
    }

    void reload().then(() => { setLoadingMsgs(false); restoreThreadScroll(activeId!); });

    // Persist scroll position while the user scrolls.
    const vp = getThreadViewport();
    const onScroll = () => {
      if (!vp) return;
      threadScrollRef.current[activeId!] = vp.scrollTop;
    };
    vp?.addEventListener("scroll", onScroll, { passive: true });
    prevActiveIdRef.current = activeId;

    const ch = supabase.channel(`conv:${activeId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${activeId}` }, (p) => {
        const m = p.new as Message;
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        scrollToBottom();
        if (m.sender_id !== user?.id) void markConversationRead(activeId).then(refreshConversations);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${activeId}` }, (p) => {
        const m = p.new as Message;
        setMessages((prev) => prev.map((x) => (x.id === m.id ? m : x)));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, async () => {
        const ms = await listReactions(messages.map((m) => m.id));
        setReactions(ms);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "conversation_members", filter: `conversation_id=eq.${activeId}` }, (p) => {
        const rec: any = p.new ?? p.old;
        if (rec?.user_id && rec?.last_read_at) {
          setMemberReads((prev) => ({ ...prev, [rec.user_id]: rec.last_read_at }));
        }
        void refreshConversations();
      })
      .on("broadcast", { event: "typing" }, (payload: any) => {
        const uid = payload?.payload?.user_id;
        if (!uid || uid === user?.id) return;
        setTypingUsers((prev) => (prev.includes(uid) ? prev : [...prev, uid]));
        // Reset per-user auto-clear timer (fires if no refresh arrives in 4s).
        const timers = typingTimersRef.current;
        if (timers[uid]) clearTimeout(timers[uid]);
        timers[uid] = setTimeout(() => {
          setTypingUsers((prev) => prev.filter((x) => x !== uid));
          delete timers[uid];
        }, 4000);
      })

      .on("broadcast", { event: "typing_stop" }, (payload: any) => {
        const uid = payload?.payload?.user_id;
        if (!uid) return;
        const timers = typingTimersRef.current;
        if (timers[uid]) { clearTimeout(timers[uid]); delete timers[uid]; }
        setTypingUsers((prev) => prev.filter((x) => x !== uid));
      })
      .subscribe((status) => {
        // Reconnect reconciliation: on (re)join, refetch the full thread so
        // any events missed during disconnect are applied deterministically.
        if (status === "SUBSCRIBED") void reload();
      });

    typingChannelRef.current = ch;

    // Periodic reconciliation (every 20s): heals delivered/read/typing after
    // silent tab throttling, network hiccups, or missed realtime events.
    const reconcile = setInterval(() => {
      if (document.hidden) return;
      void reload();
      void refreshConversations();
      // Expire stale typing indicators that never received a "stop" event.
      const timers = typingTimersRef.current;
      Object.keys(timers).forEach((k) => clearTimeout(timers[k]));
      typingTimersRef.current = {};
      setTypingUsers((prev) => (prev.length ? [] : prev));
    }, 20_000);

    // On tab becoming visible again, refetch immediately.
    const onVis = () => { if (!document.hidden) void reload(); };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      clearInterval(reconcile);
      document.removeEventListener("visibilitychange", onVis);
      // Save the current scroll position before switching away.
      if (vp && activeId) threadScrollRef.current[activeId] = vp.scrollTop;
      vp?.removeEventListener("scroll", onScroll);
      // Notify peers we stopped typing when leaving/switching the conversation.
      try {
        if (typingChannelRef.current && user?.id) {
          typingChannelRef.current.send({ type: "broadcast", event: "typing_stop", payload: { user_id: user.id } });
        }
      } catch { /* noop */ }
      if (typingStopTimerRef.current) { clearTimeout(typingStopTimerRef.current); typingStopTimerRef.current = null; }
      const timers = typingTimersRef.current;
      Object.keys(timers).forEach((k) => clearTimeout(timers[k]));
      typingTimersRef.current = {};
      lastTypingSentRef.current = 0;
      supabase.removeChannel(ch);
      typingChannelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, user?.id]);

  // Persist + restore the conversation list scroll position across sessions.
  useEffect(() => {
    if (!open) return;
    const vp = getListViewport();
    if (!vp) return;
    try {
      const saved = window.sessionStorage.getItem("faithams:chat:listScroll");
      if (saved != null) requestAnimationFrame(() => { vp.scrollTop = Number(saved) || 0; });
    } catch { /* noop */ }
    const onScroll = () => {
      try { window.sessionStorage.setItem("faithams:chat:listScroll", String(vp.scrollTop)); } catch { /* noop */ }
    };
    vp.addEventListener("scroll", onScroll, { passive: true });
    return () => vp.removeEventListener("scroll", onScroll);
  }, [open, conversations.length]);


  function scrollToBottom() {
    requestAnimationFrame(() => {
      const el = getThreadViewport();
      if (el) el.scrollTop = el.scrollHeight;
    });
  }
  function restoreThreadScroll(convId: string) {
    requestAnimationFrame(() => {
      const el = getThreadViewport();
      if (!el) return;
      const saved = threadScrollRef.current[convId];
      if (typeof saved === "number") el.scrollTop = saved;
      else el.scrollTop = el.scrollHeight;
    });
  }

  const filteredConvs = useMemo(() => {
    let list = conversations;
    if (tab === "group") list = list.filter((c) => c.type === "group");
    // "all" shows every conversation type; "people" hides this list entirely.
    if (search.trim() && tab !== "people") {
      const s = search.toLowerCase();
      list = list.filter((c) => (c.title || "").toLowerCase().includes(s) || (c.last_message?.body || "").toLowerCase().includes(s));
    }
    return list;
  }, [conversations, tab, search]);

  function sendTypingStop() {
    if (!typingChannelRef.current || !user) return;
    try {
      typingChannelRef.current.send({ type: "broadcast", event: "typing_stop", payload: { user_id: user.id } });
    } catch { /* noop */ }
    if (typingStopTimerRef.current) { clearTimeout(typingStopTimerRef.current); typingStopTimerRef.current = null; }
    lastTypingSentRef.current = 0;
  }

  async function handleSend() {
    if (!activeId) return;
    const body = text.trim();
    const readyAtts = pending.filter((p) => p.status === "done" && p.att).map((p) => p.att!);
    const stillUploading = pending.some((p) => p.status === "uploading");
    if (stillUploading) { toast.error("Wait for uploads to finish"); return; }
    if (!body && readyAtts.length === 0 && !editing) return;
    setSending(true);
    try {
      if (editing) {
        await editMessage(editing.id, body);
        setEditing(null);
      } else {
        await sendMsg(activeId, body, readyAtts, reply?.id);
      }
      // release preview URLs
      pending.forEach((p) => { if (p.previewUrl) URL.revokeObjectURL(p.previewUrl); });
      setPending([]);
      setText("");
      setReply(null);
      sendTypingStop();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to send");
    } finally { setSending(false); }
  }

  function handleTyping() {
    if (!typingChannelRef.current || !user) return;
    // If the input is empty, immediately signal stop.
    if (!text.trim() && text.length <= 1) {
      sendTypingStop();
      return;
    }
    // Debounce: at most one "typing" broadcast every 1.5s.
    const now = Date.now();
    if (now - lastTypingSentRef.current > 1500) {
      lastTypingSentRef.current = now;
      try {
        typingChannelRef.current.send({ type: "broadcast", event: "typing", payload: { user_id: user.id } });
      } catch { /* noop */ }
    }
    // Reliable stop: if the user pauses for 2.5s, tell peers we stopped.
    if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
    typingStopTimerRef.current = setTimeout(() => { sendTypingStop(); }, 2500);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!files.length || !activeId) return;
    const items: PendingUpload[] = files.map((f) => ({
      id: crypto.randomUUID(),
      file: f,
      previewUrl: f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined,
      progress: 5,
      status: "uploading",
    }));
    setPending((prev) => [...prev, ...items]);
    // Supabase JS storage upload doesn't stream progress — simulate a smooth
    // progress bar so the user sees activity, then flip to 100% on completion.
    for (const item of items) {
      const timer = setInterval(() => {
        setPending((prev) => prev.map((p) =>
          p.id === item.id && p.status === "uploading" && p.progress < 90
            ? { ...p, progress: Math.min(90, p.progress + 8 + Math.random() * 8) }
            : p,
        ));
      }, 220);
      try {
        const att = await uploadAttachment(activeId, item.file);
        clearInterval(timer);
        setPending((prev) => prev.map((p) => p.id === item.id ? { ...p, status: "done", progress: 100, att } : p));
      } catch (err: any) {
        clearInterval(timer);
        setPending((prev) => prev.map((p) => p.id === item.id ? { ...p, status: "error", error: err.message ?? "Upload failed" } : p));
        toast.error(err.message ?? "Upload failed");
      }
    }
  }

  function removePending(id: string) {
    setPending((prev) => {
      const item = prev.find((p) => p.id === id);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }

  async function handleForward(targetConvId: string) {
    if (!forwarding) return;
    try {
      const body = forwarding.body ? `↪ Forwarded:\n${forwarding.body}` : "";
      await sendMsg(targetConvId, body, forwarding.attachments ?? []);
      toast.success("Message forwarded");
      setForwarding(null);
      if (targetConvId !== activeId) openConversation(targetConvId);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to forward");
    }
  }

  // Auto-resize composer textarea (Messenger-style multi-line growth)
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, [text]);

  // In-thread search — index hits into the message list
  const threadHits = useMemo(() => {
    const q = threadQuery.trim().toLowerCase();
    if (!q) return [] as string[];
    return messages.filter((m) => (m.body || "").toLowerCase().includes(q)).map((m) => m.id);
  }, [threadQuery, messages]);

  useEffect(() => { setThreadHitIdx(0); }, [threadQuery]);

  useEffect(() => {
    if (!threadHits.length) return;
    const id = threadHits[Math.max(0, Math.min(threadHitIdx, threadHits.length - 1))];
    const el = document.getElementById(`msg-${id}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [threadHitIdx, threadHits]);


  // Load directory when new dialog opens
  useEffect(() => {
    if (!newDialog || !user) return;
    listChatPeople({ limit: 200 }).then(setDirectory).catch(() => setDirectory([]));
    setSelected([]); setGroupTitle(""); setGroupMode(false); setDirSearch("");
  }, [newDialog, user]);

  // Also load directory when the chat panel opens (for the People carousel)
  useEffect(() => {
    if (!open || !user) return;
    if (directory.length > 0) return;
    listChatPeople({ limit: 200 }).then(setDirectory).catch(() => setDirectory([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user]);


  // Load People tab (paginated, live-search)
  useEffect(() => {
    if (!user) return;
    if (tab !== "people") return;
    const t = setTimeout(() => {
      setPeoplePage(0);
      listChatPeople({ search: search.trim() || undefined, limit: 30, offset: 0 })
        .then((r) => { setPeople(r); setPeopleHasMore(r.length === 30); })
        .catch(() => setPeople([]));
    }, 200);
    return () => clearTimeout(t);
  }, [tab, search, user]);

  async function loadMorePeople() {
    const next = peoplePage + 1;
    const r = await listChatPeople({ search: search.trim() || undefined, limit: 30, offset: next * 30 });
    setPeople((prev) => [...prev, ...r]);
    setPeopleHasMore(r.length === 30);
    setPeoplePage(next);
  }

  // Global search across users/conversations/messages/apps (debounced)
  useEffect(() => {
    if (!search.trim() || tab === "people") { setSearchHits([]); setSearchHasMore(false); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const r = await searchAll(search.trim(), { limit: 25, offset: 0 });
        setSearchHits(r); setSearchHasMore(r.length === 25); setSearchPage(0);
      } finally { setSearching(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [search, tab]);

  async function loadMoreSearch() {
    const next = searchPage + 1;
    const r = await searchAll(search.trim(), { limit: 25, offset: next * 25 });
    setSearchHits((prev) => [...prev, ...r]);
    setSearchHasMore(r.length === 25);
    setSearchPage(next);
  }


  async function startDirect(otherId: string) {
    try {
      const cid = await getOrCreateDirect(otherId);
      try { await unhideConversation(cid); } catch { /* ignore */ }
      await refreshConversations();
      openConversation(cid);
      setNewDialog(false);
      setShowMobileList(false);
    } catch (e: any) { toast.error(e.message); }
  }

  async function hideConv(cid: string) {
    try {
      await hideConversation(cid);
      if (activeId === cid) openConversation("" as any);
      await refreshConversations();
      toast.success("Conversation hidden. It will reappear when a new message arrives.");
    } catch (e: any) { toast.error(e.message); }
  }

  async function createNewGroup() {
    if (!groupTitle.trim() || selected.length < 1) { toast.error("Group title and at least one member required"); return; }
    try {
      const cid = await createGroup(groupTitle.trim(), selected);
      await refreshConversations();
      openConversation(cid);
      setNewDialog(false);
      setShowMobileList(false);
    } catch (e: any) { toast.error(e.message); }
  }

  const directPeer = (c: typeof active) => {
    if (!c || c.type !== "direct") return null;
    const otherId = c.members?.find((m) => m.user_id !== user?.id)?.user_id;
    if (!otherId) return null;
    return directory.find((u) => u.id === otherId) || people.find((u) => u.id === otherId) || ({ id: otherId, full_name: null, email: null, avatar_url: null, is_online: false, last_seen_at: null, status: "offline" } as unknown as DirectoryPerson);
  };

  const conversationTitle = (c: typeof active) => {
    if (!c) return "";
    if (c.title) return c.title;
    if (c.type === "direct") {
      const peer = directPeer(c);
      return peer?.full_name || peer?.email || "Direct message";
    }
    return "Conversation";
  };


  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end sm:items-center sm:p-4 pointer-events-none">
      <div className="pointer-events-auto flex h-[100dvh] w-full sm:h-[85vh] sm:max-h-[720px] sm:w-[min(1100px,95vw)] overflow-hidden rounded-none sm:rounded-2xl border bg-background shadow-2xl">
        {/* LEFT: Conversations */}
        <aside className={cn("w-full sm:w-80 shrink-0 border-r flex flex-col", !showMobileList && "hidden sm:flex")}>
          <div className="flex items-center justify-between border-b p-3">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary"><MessageSquare className="h-4 w-4" /></div>
              <div>
                <p className="text-sm font-semibold">Chat</p>
                <p className="text-[11px] text-muted-foreground">{conversations.length} conversations</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" onClick={() => setNewDialog(true)} title="New conversation"><Plus className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" className="sm:hidden" onClick={() => setOpen(false)}><X className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" className="hidden sm:inline-flex" onClick={() => setOpen(false)}><X className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="p-2">
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search people, chats, messages, apps…" className="h-8 pl-7" />
              </div>
              <Button
                type="button"
                variant={mentionsOnly ? "default" : "ghost"}
                size="icon"
                className="h-8 w-8 shrink-0"
                title={mentionsOnly ? "Alerts: @mentions only (click for all messages)" : "Alerts: all messages (click for @mentions only)"}
                onClick={() => setMentionsOnly(!mentionsOnly)}
              >
                {mentionsOnly ? <AtSign className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
              </Button>
            </div>
            {mentionsOnly && (
              <p className="mt-1 flex items-center gap-1 px-0.5 text-[10px] text-muted-foreground">
                <BellOff className="h-3 w-3" /> Muted — chime only for @mentions
              </p>
            )}
          </div>
          {(() => {
            const stripPeople = directory
              .map((p) => {
                const live = presence[p.id];
                const isOnline = live ? live.status === "online" : p.is_online;
                const lastSeen = live?.last_seen_at ?? p.last_seen_at;
                return { p, isOnline, lastSeen };
              })
              .sort((a, b) => Number(b.isOnline) - Number(a.isOnline));
            if (stripPeople.length === 0) return null;
            return (
              <div className="relative border-b px-2 pb-2 pt-1">
                <div
                  ref={peopleStripRef}
                  role="listbox"
                  aria-label="People — swipe or drag to scroll, tap to start a chat"
                  onPointerDown={(e) => {
                    const el = peopleStripRef.current;
                    if (!el) return;
                    // Only left-mouse / touch / pen
                    if (e.pointerType === "mouse" && e.button !== 0) return;
                    const state = {
                      startX: e.clientX,
                      startScroll: el.scrollLeft,
                      lastX: e.clientX,
                      lastT: performance.now(),
                      velocity: 0,
                      moved: false,
                      pointerId: e.pointerId,
                      raf: 0 as number,
                    };
                    (el as any).__drag = state;
                    el.style.scrollSnapType = "none";
                    el.style.cursor = "grabbing";
                    try { el.setPointerCapture(e.pointerId); } catch { /* noop */ }
                  }}
                  onPointerMove={(e) => {
                    const el = peopleStripRef.current;
                    const s: any = el && (el as any).__drag;
                    if (!el || !s) return;
                    const dx = e.clientX - s.startX;
                    if (Math.abs(dx) > 4) s.moved = true;
                    el.scrollLeft = s.startScroll - dx;
                    const now = performance.now();
                    const dt = Math.max(1, now - s.lastT);
                    s.velocity = (e.clientX - s.lastX) / dt; // px per ms
                    s.lastX = e.clientX;
                    s.lastT = now;
                  }}
                  onPointerUp={(e) => {
                    const el = peopleStripRef.current;
                    const s: any = el && (el as any).__drag;
                    if (!el || !s) return;
                    (el as any).__drag = null;
                    el.style.cursor = "";
                    try { el.releasePointerCapture(s.pointerId); } catch { /* noop */ }
                    // Momentum: velocity-based decay with device-consistent thresholds.
                    // Tuned for iOS Safari (fast flicks), Android Chrome, and desktop trackpads.
                    let v = s.velocity * 15; // px per frame (~16ms)
                    // Clamp extreme flicks so iOS doesn't rocket the strip.
                    const MAX_V = 60;
                    if (v > MAX_V) v = MAX_V;
                    else if (v < -MAX_V) v = -MAX_V;
                    const step = () => {
                      if (!peopleStripRef.current) return;
                      if (Math.abs(v) < 0.25) {
                        peopleStripRef.current.style.scrollSnapType = "x mandatory";
                        // Let snap settle, then relax back to proximity.
                        setTimeout(() => {
                          if (peopleStripRef.current) peopleStripRef.current.style.scrollSnapType = "x proximity";
                        }, 180);
                        return;
                      }
                      peopleStripRef.current.scrollLeft -= v;
                      v *= 0.93;
                      s.raf = requestAnimationFrame(step);
                    };
                    if (Math.abs(v) > 0.35) {
                      s.raf = requestAnimationFrame(step);
                    } else {
                      el.style.scrollSnapType = "x mandatory";
                      setTimeout(() => {
                        if (peopleStripRef.current) peopleStripRef.current.style.scrollSnapType = "x proximity";
                      }, 180);
                    }
                    // Swallow click if we actually dragged
                    if (s.moved) {
                      const blocker = (ev: MouseEvent) => { ev.stopPropagation(); ev.preventDefault(); el.removeEventListener("click", blocker, true); };
                      el.addEventListener("click", blocker, true);
                    }
                  }}
                  onPointerCancel={() => {
                    const el = peopleStripRef.current;
                    if (!el) return;
                    (el as any).__drag = null;
                    el.style.cursor = "";
                    el.style.scrollSnapType = "x proximity";
                  }}
                  className="flex gap-3 overflow-x-auto scroll-smooth px-1 py-1 select-none cursor-grab touch-pan-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [scroll-snap-type:x_proximity]"
                  style={{ WebkitOverflowScrolling: "touch", overscrollBehaviorX: "contain" }}
                >
                  {stripPeople.map(({ p, isOnline }) => (
                    <button
                      key={p.id}
                      role="option"
                      aria-label={`Chat with ${p.full_name || p.email}${isOnline ? ", online" : ""}`}
                      onClick={() => startDirect(p.id)}
                      className="group flex w-14 shrink-0 snap-start flex-col items-center gap-1 rounded-lg p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary animate-fade-in"
                      title={p.full_name || p.email || "User"}
                      draggable={false}
                    >
                      <div className="relative pointer-events-none">
                        <Avatar className="h-12 w-12 ring-2 ring-background transition-transform group-hover:scale-105 group-hover:ring-primary/40">
                          <AvatarImage src={p.avatar_url ?? undefined} draggable={false} />
                          <AvatarFallback className="text-xs">{initials(p.full_name, p.email)}</AvatarFallback>
                        </Avatar>
                        {isOnline && (
                          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background bg-emerald-500" aria-hidden />
                        )}
                      </div>
                      <span className="w-full truncate text-center text-[10px] text-muted-foreground group-hover:text-foreground pointer-events-none">
                        {(p.full_name || p.email || "").split(" ")[0]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}




          <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="px-2">
            <TabsList className="grid w-full grid-cols-3 h-8">
              <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
              <TabsTrigger value="group" className="text-xs">Groups</TabsTrigger>
              <TabsTrigger value="people" className="text-xs">People</TabsTrigger>
            </TabsList>
          </Tabs>
          <ScrollArea className="flex-1" ref={convListScrollRef as any}>
            {tab === "people" ? (
              <ul>
                {people.length === 0 ? (
                  <li className="p-6 text-center text-xs text-muted-foreground">No people found</li>
                ) : people.map((p) => {
                  // Overlay real-time presence from context on top of RPC snapshot.
                  const live = presence[p.id];
                  const isOnline = live ? live.status === "online" : p.is_online;
                  const isAway = live?.status === "away";
                  const lastSeen = live?.last_seen_at ?? p.last_seen_at;
                  return (
                    <li key={p.id}>
                      <button
                        onClick={() => startDirect(p.id)}
                        className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-accent/50 border-b"
                      >
                        <div className="relative">
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={p.avatar_url ?? undefined} />
                            <AvatarFallback className="text-xs">{initials(p.full_name, p.email)}</AvatarFallback>
                          </Avatar>
                          <span
                            className={cn(
                              "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background",
                              isOnline ? "bg-emerald-500" : isAway ? "bg-amber-500" : "bg-muted-foreground/40",
                            )}
                            title={isOnline ? "Online" : isAway ? "Away" : "Offline"}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{p.full_name || p.email}</p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {isOnline
                              ? "Online now"
                              : isAway
                                ? "Away"
                                : lastSeen
                                  ? `Last seen ${formatDistanceToNow(new Date(lastSeen), { addSuffix: true })}`
                                  : "Offline"}
                          </p>
                        </div>
                      </button>
                    </li>
                  );
                })}

                {peopleHasMore && (
                  <li className="p-2 text-center"><Button size="sm" variant="ghost" onClick={loadMorePeople}>Load more</Button></li>
                )}
              </ul>
            ) : search.trim() ? (
              <div>
                {searching && <div className="p-3 text-center text-xs text-muted-foreground"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></div>}
                {!searching && searchHits.length === 0 && <div className="p-6 text-center text-xs text-muted-foreground">No results</div>}
                <ul>
                  {searchHits.map((h) => (
                    <li key={`${h.kind}:${h.id}`}>
                      <button
                        onClick={async () => {
                          if (h.kind === "user") { await startDirect(h.id); return; }
                          if (h.conversation_id) { openConversation(h.conversation_id); setShowMobileList(false); return; }
                        }}
                        className="w-full text-left px-3 py-2 flex items-start gap-2 hover:bg-accent/50 border-b"
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={h.avatar_url ?? undefined} />
                          <AvatarFallback className="text-[10px]">{initials(h.title)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="h-4 px-1 text-[9px] uppercase">{h.kind}</Badge>
                            <p className="truncate text-sm font-medium">{h.title}</p>
                          </div>
                          {h.snippet && <p className="truncate text-xs text-muted-foreground">{h.snippet}</p>}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
                {searchHasMore && <div className="p-2 text-center"><Button size="sm" variant="ghost" onClick={loadMoreSearch}>Load more</Button></div>}
              </div>
            ) : refreshing && filteredConvs.length === 0 ? (
              <ul aria-busy="true" aria-label="Loading conversations">
                {Array.from({ length: 7 }).map((_, i) => (
                  <li key={i} className="flex items-center gap-3 px-3 py-2.5 border-b animate-pulse">
                    <div className="h-12 w-12 rounded-full bg-muted" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="h-3 w-2/5 rounded bg-muted" />
                      <div className="h-2.5 w-4/5 rounded bg-muted/70" />
                    </div>
                    <div className="h-2.5 w-8 rounded bg-muted/60" />
                  </li>
                ))}
              </ul>
            ) : filteredConvs.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">No conversations yet. Click + to start.</div>

            ) : (
              <ul
                ref={convListRef}
                role="listbox"
                aria-label="Conversations"
                onKeyDown={(e) => {
                  const btns = Array.from(convListRef.current?.querySelectorAll<HTMLButtonElement>('button[data-conv-row="1"]') ?? []);
                  const idx = btns.findIndex((b) => b === document.activeElement);
                  if (e.key === "ArrowDown") { e.preventDefault(); btns[Math.min(btns.length - 1, idx + 1)]?.focus(); }
                  else if (e.key === "ArrowUp") { e.preventDefault(); btns[Math.max(0, idx - 1)]?.focus(); }
                  else if (e.key === "Home") { e.preventDefault(); btns[0]?.focus(); }
                  else if (e.key === "End") { e.preventDefault(); btns[btns.length - 1]?.focus(); }
                }}
              >
                {filteredConvs.map((c) => {
                  const otherId = c.type === "direct" ? c.members?.find((m) => m.user_id !== user?.id)?.user_id : null;
                  const online = otherId && presence[otherId]?.status === "online";
                  const isActive = activeId === c.id;
                  const hasUnread = c.unread_count > 0;
                  const title = conversationTitle(c) || (c.type === "application" ? "Application chat" : "Chat");
                  return (
                    <li key={c.id} className="animate-fade-in">
                      <div
                        className={cn(
                          "group relative flex items-stretch transition-colors",
                          isActive ? "bg-accent" : "hover:bg-accent/60 active:bg-accent",
                        )}
                      >
                        <button
                          data-conv-row="1"
                          role="option"
                          aria-selected={isActive}
                          aria-label={`${title}${hasUnread ? `, ${c.unread_count} unread` : ""}${online ? ", online" : ""}`}
                          onClick={() => { openConversation(c.id); setShowMobileList(false); }}
                          className="min-h-[64px] flex-1 min-w-0 flex items-center gap-3 px-3 py-2.5 text-left rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                        >
                          <div className="relative shrink-0">
                            <Avatar className="h-12 w-12">
                              <AvatarImage src={directPeer(c)?.avatar_url ?? undefined} />
                              <AvatarFallback className="text-xs">{initials(title, otherId ?? undefined)}</AvatarFallback>
                            </Avatar>
                            {online && (
                              <span
                                className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background bg-emerald-500"
                                aria-hidden
                              />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className={cn(
                                "truncate text-[15px] leading-tight",
                                hasUnread ? "font-semibold text-foreground" : "font-medium text-foreground",
                              )}>{title}</p>
                            </div>
                            <div className="mt-0.5 flex items-center gap-1.5">
                              <p className={cn(
                                "min-w-0 flex-1 line-clamp-1 text-[13px] leading-snug [overflow-wrap:anywhere] [word-break:break-word] break-all",
                                hasUnread ? "text-foreground/90 font-medium" : "text-muted-foreground",
                              )}>
                                {c.last_message?.body || "No messages yet"}
                              </p>
                              {c.last_message_at && (
                                <>
                                  <span className="text-muted-foreground/60" aria-hidden>·</span>
                                  <span className="shrink-0 text-[12px] text-muted-foreground">
                                    {formatDistanceToNow(new Date(c.last_message_at), { addSuffix: false })}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="ml-1 flex shrink-0 items-center self-center">
                            {hasUnread && (
                              <span
                                className="grid h-5 min-w-[20px] place-items-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground shadow-sm animate-scale-in"
                                aria-label={`${c.unread_count} unread messages`}
                              >
                                {c.unread_count > 99 ? "99+" : c.unread_count}
                              </span>
                            )}
                          </div>
                        </button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute right-1 top-1 h-7 w-7 opacity-0 group-hover:opacity-100 focus:opacity-100 data-[state=open]:opacity-100"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem onClick={() => hideConv(c.id)}>
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete from list
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </ScrollArea>
        </aside>


        {/* CENTER: Thread */}
        <section className={cn("flex-1 flex flex-col min-w-0", showMobileList && "hidden sm:flex")}>
          {!active ? (
            <div className="grid flex-1 place-items-center text-center p-8">
              <div>
                <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary"><MessageSquare className="h-7 w-7" /></div>
                <p className="text-sm font-medium">Select a conversation</p>
                <p className="mt-1 text-xs text-muted-foreground">Choose a chat from the left or start a new one.</p>
              </div>
            </div>
          ) : (
            <>
              <header className="flex items-center gap-2 border-b p-3">
                <Button variant="ghost" size="icon" className="sm:hidden" onClick={() => setShowMobileList(true)}><ChevronLeft className="h-4 w-4" /></Button>
                {(() => {
                  const peer = directPeer(active);
                  const live = peer ? presence[peer.id] : undefined;
                  const isOnline = live ? live.status === "online" : peer?.is_online;
                  const isAway = live?.status === "away";
                  const lastSeen = peer?.last_seen_at ? formatDistanceToNow(new Date(peer.last_seen_at), { addSuffix: true }) : null;
                  return (
                    <>
                      <div className="relative">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={peer?.avatar_url ?? undefined} />
                          <AvatarFallback className="text-xs">{initials(conversationTitle(active))}</AvatarFallback>
                        </Avatar>
                        {active.type === "direct" && (
                          <span className={cn("absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background", isOnline ? "bg-emerald-500" : isAway ? "bg-amber-500" : "bg-muted-foreground/40")} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{conversationTitle(active)}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {typingUsers.length > 0
                            ? "typing…"
                            : active.type === "direct"
                              ? (isOnline ? "Online" : isAway ? "Away" : lastSeen ? `Last seen ${lastSeen}` : (peer?.email || "Offline"))
                              : `${active.members?.length ?? 0} members`}
                        </p>
                      </div>
                    </>
                  );
                })()}
                <Button variant="ghost" size="icon" onClick={() => setThreadSearchOpen((v) => !v)} title="Search in conversation"><Search className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => setShowInfo((v) => !v)}><Info className="h-4 w-4" /></Button>
              </header>
              {threadSearchOpen && (
                <div className="flex items-center gap-2 border-b bg-muted/30 p-2">
                  <Search className="h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    autoFocus
                    value={threadQuery}
                    onChange={(e) => setThreadQuery(e.target.value)}
                    placeholder="Find in conversation…"
                    className="h-8 flex-1"
                  />
                  <span className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap">
                    {threadHits.length ? `${Math.min(threadHitIdx + 1, threadHits.length)} / ${threadHits.length}` : "0 / 0"}
                  </span>
                  <Button size="icon" variant="ghost" className="h-7 w-7" disabled={!threadHits.length} onClick={() => setThreadHitIdx((i) => (i - 1 + threadHits.length) % threadHits.length)}><ChevronUp className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" disabled={!threadHits.length} onClick={() => setThreadHitIdx((i) => (i + 1) % threadHits.length)}><ChevronDown className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setThreadSearchOpen(false); setThreadQuery(""); }}><X className="h-3.5 w-3.5" /></Button>
                </div>
              )}

              {(() => {
                const pinned = messages.filter((m) => m.pinned && !m.deleted_at);
                if (pinned.length === 0) return null;
                return (
                  <div className="border-b bg-amber-50/70 dark:bg-amber-950/20">
                    <button
                      type="button"
                      onClick={() => setShowPinned((v) => !v)}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] font-medium text-amber-900 dark:text-amber-200 hover:bg-amber-100/50 dark:hover:bg-amber-950/40"
                    >
                      <Pin className="h-3 w-3" />
                      <span>{pinned.length} pinned message{pinned.length > 1 ? "s" : ""}</span>
                      {showPinned ? <ChevronUp className="ml-auto h-3 w-3" /> : <ChevronDown className="ml-auto h-3 w-3" />}
                    </button>
                    {showPinned && (
                      <div className="max-h-40 overflow-y-auto px-2 pb-2 space-y-1">
                        {pinned.map((pm) => (
                          <div key={pm.id} className="group flex items-start gap-2 rounded-md border border-amber-200/60 dark:border-amber-900/40 bg-background/70 px-2 py-1.5 text-xs">
                            <Pin className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" />
                            <button
                              type="button"
                              onClick={() => scrollToMessage(pm.id)}
                              className="min-w-0 flex-1 text-left"
                              title="Jump to message"
                            >
                              <p className="line-clamp-2 whitespace-pre-wrap break-words">
                                {pm.body || (pm.attachments?.length ? `📎 ${pm.attachments[0].name}` : "(attachment)")}
                              </p>
                              <p className="mt-0.5 text-[10px] text-muted-foreground">{format(new Date(pm.created_at), "MMM d, HH:mm")}</p>
                            </button>
                            <Button size="icon" variant="ghost" className="h-6 w-6 opacity-60 hover:opacity-100" title="Unpin" onClick={() => togglePin(pm.id, false)}>
                              <PinOff className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              <ScrollArea className="flex-1 bg-gradient-to-b from-background to-muted/20 [&>[data-radix-scroll-area-viewport]>div]:!block [&>[data-radix-scroll-area-viewport]>div]:!w-full [&>[data-radix-scroll-area-viewport]]:!block" ref={scrollRef as any}>
                <div className="p-4 space-y-0.5 min-w-0 w-full max-w-full overflow-x-hidden">

                  {loadingMsgs ? (
                    <div className="grid place-items-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                  ) : messages.length === 0 ? (
                    <div className="text-center py-10 text-xs text-muted-foreground">No messages yet. Say hi 👋</div>
                  ) : messages.map((m, i) => {
                    const prev = messages[i-1];
                    const next = messages[i+1];
                    const currDate = new Date(m.created_at);
                    const showDate = !prev || dateLabel(new Date(prev.created_at)) !== dateLabel(currDate);
                    const mine = m.sender_id === user?.id;
                    const rx = reactions.filter((r) => r.message_id === m.id);
                    const rxGrouped = Object.entries(rx.reduce((a: any, r) => { a[r.emoji] = (a[r.emoji] || 0) + 1; return a; }, {}));
                    const replyMsg = m.reply_to_id ? messages.find((x) => x.id === m.reply_to_id) : null;

                    // Messenger-style grouping: same sender within 5 min
                    const sameAsPrev = prev && prev.sender_id === m.sender_id && !showDate
                      && (currDate.getTime() - new Date(prev.created_at).getTime()) < 5 * 60_000;
                    const sameAsNext = next && next.sender_id === m.sender_id
                      && (new Date(next.created_at).getTime() - currDate.getTime()) < 5 * 60_000
                      && dateLabel(new Date(next.created_at)) === dateLabel(currDate);
                    const isLastOfGroup = !sameAsNext;
                    const isFirstOfGroup = !sameAsPrev;

                    const bubbleRadius = mine
                      ? cn("rounded-2xl", !isFirstOfGroup && "rounded-tr-md", !isLastOfGroup && "rounded-br-md")
                      : cn("rounded-2xl", !isFirstOfGroup && "rounded-tl-md", !isLastOfGroup && "rounded-bl-md");

                    return (
                      <div key={m.id} id={`msg-${m.id}`}>
                        {showDate && (
                          <div className="my-4 flex items-center justify-center">
                            <span className="rounded-full bg-muted/70 px-3 py-0.5 text-[10px] font-medium text-muted-foreground">{dateLabel(currDate)}</span>
                          </div>
                        )}
                        <div className={cn("group flex items-end gap-2 w-full min-w-0", mine ? "justify-end" : "justify-start", sameAsPrev ? "mt-0.5" : "mt-2")}>
                          {!mine && (
                            <div className="w-7 shrink-0">
                              {isLastOfGroup && (
                                <Avatar className="h-7 w-7">
                                  <AvatarImage src={directPeer(active)?.avatar_url ?? undefined} />
                                  <AvatarFallback className="text-[10px]">{initials(null, m.sender_id ?? undefined)}</AvatarFallback>
                                </Avatar>
                              )}
                            </div>
                          )}
                          <div className={cn("relative min-w-0 max-w-[75%] px-3.5 py-2 shadow-sm transition-shadow [overflow-wrap:anywhere] [word-break:break-word] break-words",
                            bubbleRadius,
                            mine ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
                            threadQuery.trim() && threadHits.includes(m.id) && "ring-2 ring-amber-400/70",
                            threadQuery.trim() && threadHits[threadHitIdx] === m.id && "ring-4 ring-amber-500",
                            highlightId === m.id && "ring-4 ring-primary/60")}>
                            {replyMsg && (
                              <button
                                type="button"
                                onClick={() => scrollToMessage(replyMsg.id)}
                                className={cn("mb-1 block w-full text-left rounded border-l-2 pl-2 pr-1 py-0.5 text-[11px] opacity-80 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 transition [overflow-wrap:anywhere]",
                                  mine ? "border-primary-foreground/40" : "border-primary/40")}
                                title="Jump to original message"
                              >

                                <p className="line-clamp-2 [overflow-wrap:anywhere] [word-break:break-word] break-all">{replyMsg.body || "(attachment)"}</p>
                              </button>
                            )}
                            {m.deleted_at ? (
                              <p className="text-xs italic opacity-60">This message was deleted</p>
                            ) : (
                              <>
                                {m.body && <p className="chat-body whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere] [word-break:break-word] break-words">{linkifyText(m.body)}</p>}
                                {m.attachments?.length > 0 && (() => {
                                  const media = m.attachments.filter((a) => a.type?.startsWith("image/") || a.type?.startsWith("video/"));
                                  const files = m.attachments.filter((a) => !a.type?.startsWith("image/") && !a.type?.startsWith("video/"));
                                  return (
                                    <div className="mt-1 space-y-1">
                                      {media.length > 0 && (
                                        <div className={cn("grid gap-1", media.length === 1 ? "grid-cols-1" : media.length === 2 ? "grid-cols-2" : "grid-cols-2")}>
                                          {media.slice(0, 4).map((a, idx) => (
                                            <button
                                              key={idx}
                                              type="button"
                                              onClick={() => setLightbox({ items: media, index: idx })}
                                              className="group/thumb relative overflow-hidden rounded-md border bg-black/5"
                                            >
                                              {a.type?.startsWith("video/") ? (
                                                <>
                                                  <video src={a.url} className="h-28 w-full object-cover" muted preload="metadata" />
                                                  <span className="absolute inset-0 grid place-items-center bg-black/20"><Film className="h-6 w-6 text-white drop-shadow" /></span>
                                                </>
                                              ) : (
                                                <img src={a.url} alt={a.name} className="h-28 w-full object-cover transition-transform group-hover/thumb:scale-105" />
                                              )}
                                              {idx === 3 && media.length > 4 && (
                                                <span className="absolute inset-0 grid place-items-center bg-black/60 text-sm font-semibold text-white">+{media.length - 4}</span>
                                              )}
                                            </button>
                                          ))}
                                        </div>
                                      )}
                                      {files.map((a, idx) => <AttachmentPreview key={`f${idx}`} att={a} />)}
                                    </div>
                                  );
                                })()}
                              </>
                            )}
                            {isLastOfGroup && (() => {
                              const others = (active.members ?? []).filter((mb) => mb.user_id !== user?.id);
                              const readByCount = others.filter((mb) => {
                                const r = memberReads[mb.user_id];
                                return r && new Date(r).getTime() >= currDate.getTime();
                              }).length;
                              const isRead = others.length > 0 && readByCount === others.length;
                              const isPartial = readByCount > 0 && !isRead;
                              const receiptLabel = isRead ? "Read" : isPartial ? `Read by ${readByCount}/${others.length}` : "Delivered";
                              return (
                                <div className={cn("mt-1 flex items-center gap-1 text-[10px]", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                                  <span>{format(currDate, "HH:mm")}</span>
                                  {m.edited_at && <span>· edited</span>}
                                  {mine && m.pinned && <Pin className="h-2.5 w-2.5" />}
                                  {mine && (
                                    isRead
                                      ? <CheckCheck className="h-3 w-3 text-sky-300" aria-label="Read" />
                                      : isPartial
                                        ? <CheckCheck className="h-3 w-3" aria-label={receiptLabel} />
                                        : <Check className="h-3 w-3" aria-label="Delivered" />
                                  )}
                                  {mine && <span className="sr-only">{receiptLabel}</span>}
                                </div>
                              );
                            })()}
                            {rxGrouped.length > 0 && (
                              <div className={cn("absolute -bottom-2 flex flex-wrap gap-1", mine ? "right-2" : "left-2")}>
                                {rxGrouped.map(([e, n]) => (
                                  <button key={e} onClick={() => reactToMessage(m.id, e)} className="rounded-full border bg-background px-1.5 py-0.5 text-[10px] text-foreground shadow-sm hover:bg-accent">
                                    {e} {n as number}
                                  </button>
                                ))}
                              </div>
                            )}
                            {!m.deleted_at && (
                              <div className={cn("absolute top-1/2 -translate-y-1/2 hidden gap-0.5 rounded-full border bg-background p-0.5 shadow-md group-hover:flex",
                                mine ? "right-full mr-2" : "left-full ml-2")}>
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button size="icon" variant="ghost" className="h-6 w-6"><Smile className="h-3 w-3" /></Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-1"><div className="flex gap-1">
                                    {EMOJIS.map((e) => (
                                      <button key={e} onClick={() => reactToMessage(m.id, e)} className="rounded p-1 hover:bg-accent text-base">{e}</button>
                                    ))}
                                  </div></PopoverContent>
                                </Popover>
                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setReply(m)} title="Reply"><Reply className="h-3 w-3" /></Button>
                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setForwarding(m)} title="Forward"><Forward className="h-3 w-3" /></Button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="h-6 w-6"><MoreHorizontal className="h-3 w-3" /></Button></DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(m.body || ""); toast.success("Copied"); }}><Copy className="mr-2 h-3.5 w-3.5" />Copy</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setForwarding(m)}><Forward className="mr-2 h-3.5 w-3.5" />Forward</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => togglePin(m.id, !m.pinned)}><Pin className="mr-2 h-3.5 w-3.5" />{m.pinned ? "Unpin" : "Pin"}</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => toggleStar(m.id, true)}><Star className="mr-2 h-3.5 w-3.5" />Star</DropdownMenuItem>
                                    {mine && <DropdownMenuItem onClick={() => { setEditing(m); setText(m.body || ""); }}><Edit3 className="mr-2 h-3.5 w-3.5" />Edit</DropdownMenuItem>}
                                    {mine && <DropdownMenuItem className="text-destructive" onClick={() => deleteMessage(m.id)}><Trash2 className="mr-2 h-3.5 w-3.5" />Delete</DropdownMenuItem>}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {typingUsers.length > 0 && (
                    <div className="flex items-end gap-2 pt-2">
                      <div className="w-7" />
                      <div className="rounded-2xl bg-secondary px-3 py-2.5 shadow-sm">
                        <div className="flex gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0ms]" />
                          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:150ms]" />
                          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:300ms]" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Composer — Messenger style */}
              <div className="border-t bg-background p-3">
                {(reply || editing) && (
                  <div className="mb-2 flex items-center justify-between rounded-lg border bg-muted/40 px-2 py-1 text-xs">
                    <span className="truncate">
                      {editing ? "Editing message" : `Replying to: ${reply?.body?.slice(0, 60) || "(attachment)"}`}
                    </span>
                    <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => { setReply(null); setEditing(null); setText(""); }}><X className="h-3 w-3" /></Button>
                  </div>
                )}
                {pending.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {pending.map((p) => (
                      <div key={p.id} className="relative w-32 rounded-lg border bg-muted/40 p-1.5">
                        <button
                          type="button"
                          onClick={() => removePending(p.id)}
                          className="absolute -right-1.5 -top-1.5 z-10 grid h-5 w-5 place-items-center rounded-full border bg-background shadow-sm hover:bg-accent"
                          title="Remove"
                        >
                          <X className="h-3 w-3" />
                        </button>
                        {p.previewUrl && p.file.type.startsWith("image/") ? (
                          <button
                            type="button"
                            onClick={() => {
                              const media = pending.filter((x) => x.previewUrl && (x.file.type.startsWith("image/") || x.file.type.startsWith("video/")));
                              const idx = media.findIndex((x) => x.id === p.id);
                              setLightbox({ items: media.map((x) => ({ url: x.previewUrl!, name: x.file.name, type: x.file.type })), index: Math.max(0, idx) });
                            }}
                            className="block w-full"
                            title="Preview"
                          >
                            <img src={p.previewUrl} alt={p.file.name} className="h-20 w-full rounded object-cover" />
                          </button>
                        ) : p.previewUrl && p.file.type.startsWith("video/") ? (
                          <button
                            type="button"
                            onClick={() => {
                              const media = pending.filter((x) => x.previewUrl && (x.file.type.startsWith("image/") || x.file.type.startsWith("video/")));
                              const idx = media.findIndex((x) => x.id === p.id);
                              setLightbox({ items: media.map((x) => ({ url: x.previewUrl!, name: x.file.name, type: x.file.type })), index: Math.max(0, idx) });
                            }}
                            className="relative block w-full"
                            title="Preview"
                          >
                            <video src={p.previewUrl} className="h-20 w-full rounded object-cover" muted preload="metadata" />
                            <span className="absolute inset-0 grid place-items-center rounded bg-black/25"><Film className="h-5 w-5 text-white drop-shadow" /></span>
                          </button>
                        ) : (
                          <div className="flex h-20 w-full flex-col items-center justify-center rounded bg-background/70 text-center">
                            <FileText className="h-6 w-6 text-muted-foreground" />
                            <span className="mt-1 line-clamp-1 px-1 text-[10px] text-muted-foreground">{p.file.name}</span>
                          </div>
                        )}
                        <div className="mt-1 flex items-center gap-1">
                          {p.status === "uploading" && <Loader2 className="h-3 w-3 shrink-0 animate-spin text-muted-foreground" />}
                          {p.status === "done" && <Check className="h-3 w-3 shrink-0 text-emerald-500" />}
                          {p.status === "error" && <X className="h-3 w-3 shrink-0 text-destructive" />}
                          <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn(
                                "h-full transition-all",
                                p.status === "error" ? "bg-destructive" : p.status === "done" ? "bg-emerald-500" : "bg-primary",
                              )}
                              style={{ width: `${Math.round(p.progress)}%` }}
                            />
                          </div>
                          <span className="w-8 shrink-0 text-right text-[9px] tabular-nums text-muted-foreground">{Math.round(p.progress)}%</span>
                        </div>
                        {p.status === "error" && (
                          <div className="mt-1 flex items-center justify-between gap-1">
                            <span className="line-clamp-2 text-[10px] text-destructive">{p.error || "Upload failed"}</span>
                            <button type="button" onClick={() => retryUpload(p.id)} className="shrink-0 rounded border border-destructive/40 px-1.5 py-0.5 text-[10px] text-destructive hover:bg-destructive/10">Retry</button>
                          </div>
                        )}
                        {p.status === "uploading" && (
                          <button type="button" onClick={() => removePending(p.id)} className="mt-1 w-full text-[10px] text-muted-foreground hover:text-foreground">Cancel</button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <input ref={fileInputRef} type="file" multiple hidden onChange={handleUpload} />
                  <Button size="icon" variant="ghost" className="h-9 w-9 rounded-full text-primary hover:bg-primary/10 shrink-0" onClick={() => fileInputRef.current?.click()} title="Attach"><Paperclip className="h-4 w-4" /></Button>
                  <div className="flex-1 flex items-end gap-1 rounded-3xl bg-muted/60 px-3 py-1 focus-within:ring-2 focus-within:ring-primary/30 transition">
                    <Textarea
                      ref={textareaRef}
                      value={text}
                      onChange={(e) => { setText(e.target.value); handleTyping(); }}
                      onBlur={() => sendTypingStop()}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                      placeholder="Aa"
                      rows={1}
                      className="min-h-8 max-h-40 flex-1 resize-none border-0 bg-transparent px-1 py-1.5 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                    <Popover>
                      <PopoverTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7 rounded-full text-primary hover:bg-primary/10 shrink-0" title="Emoji"><Smile className="h-4 w-4" /></Button></PopoverTrigger>
                      <PopoverContent className="w-auto p-2" align="end"><div className="grid grid-cols-6 gap-1">
                        {EMOJIS.concat(["😊","😍","🤔","😴","🥳","😎","💪","🌟","☕","🍕","🎯","💡"]).map((e) => (
                          <button key={e} onClick={() => setText((t) => t + e)} className="rounded p-1 hover:bg-accent text-lg">{e}</button>
                        ))}
                      </div></PopoverContent>
                    </Popover>
                  </div>
                  <Button
                    size="icon"
                    onClick={handleSend}
                    disabled={sending || pending.some((p) => p.status === "uploading") || (!text.trim() && !editing && pending.filter((p) => p.status === "done").length === 0)}
                    className="h-9 w-9 rounded-full shrink-0"
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </>
          )}
        </section>

        {/* RIGHT: Info */}
        {showInfo && active && (
          <aside className="hidden lg:flex w-72 shrink-0 border-l flex-col">
            <div className="flex items-center justify-between border-b p-3">
              <p className="text-sm font-semibold">Details</p>
              <Button size="icon" variant="ghost" onClick={() => setShowInfo(false)}><X className="h-4 w-4" /></Button>
            </div>
            <ScrollArea className="flex-1 p-3 space-y-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Members</p>
                <div className="space-y-1">
                  {active.members?.map((m) => (
                    <div key={m.user_id} className="flex items-center gap-2 text-xs">
                      <Avatar className="h-6 w-6"><AvatarFallback className="text-[10px]">{initials(null, m.user_id)}</AvatarFallback></Avatar>
                      <span className="truncate">{m.user_id.slice(0, 8)}…</span>
                      {presence[m.user_id]?.status === "online" && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                      {m.role === "owner" && <Badge variant="outline" className="ml-auto text-[9px] h-4">Owner</Badge>}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Shared files</p>
                <div className="space-y-1">
                  {messages.flatMap((m) => (m.attachments || []).map((a) => ({ a, m }))).slice(-10).map(({ a }, i) => (
                    <a key={i} href={a.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded p-1 text-xs hover:bg-accent">
                      {a.type?.startsWith("image/") ? <ImageIcon className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                      <span className="truncate">{a.name}</span>
                    </a>
                  ))}
                  {messages.every((m) => !m.attachments?.length) && <p className="text-[11px] text-muted-foreground">No shared files</p>}
                </div>
              </div>
              {active.type === "application" && active.application_id && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Application</p>
                  <a href={`/applications/${active.application_id}`} className="text-xs text-primary hover:underline">View application →</a>
                </div>
              )}
            </ScrollArea>
          </aside>
        )}
      </div>

      {/* New conversation dialog */}
      <UIDialog open={newDialog} onOpenChange={setNewDialog}>
        <UIDialogContent className="max-w-md">
          <UIDialogHeader><UIDialogTitle>{groupMode ? "New group" : "Start a chat"}</UIDialogTitle></UIDialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button size="sm" variant={groupMode ? "outline" : "default"} onClick={() => setGroupMode(false)}>Direct</Button>
              <Button size="sm" variant={groupMode ? "default" : "outline"} onClick={() => setGroupMode(true)}><Users className="mr-1 h-3.5 w-3.5" />Group</Button>
            </div>
            {groupMode && <Input placeholder="Group name" value={groupTitle} onChange={(e) => setGroupTitle(e.target.value)} />}
            <Input placeholder="Search people…" value={dirSearch} onChange={(e) => setDirSearch(e.target.value)} />
            <ScrollArea className="max-h-64 rounded-md border">
              {directory.filter((u) => {
                if (!dirSearch) return true;
                const s = dirSearch.toLowerCase();
                return (u.full_name || "").toLowerCase().includes(s) || u.email.toLowerCase().includes(s);
              }).map((u) => (
                <div key={u.id} className="flex items-center gap-2 border-b p-2 hover:bg-accent/50">
                  {groupMode && (
                    <Checkbox
                      checked={selected.includes(u.id)}
                      onCheckedChange={(v) => setSelected((prev) => v ? [...prev, u.id] : prev.filter((x) => x !== u.id))}
                    />
                  )}
                  <Avatar className="h-8 w-8"><AvatarImage src={u.avatar_url ?? undefined} /><AvatarFallback className="text-[10px]">{initials(u.full_name, u.email)}</AvatarFallback></Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{u.full_name || u.email}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{u.email}</p>
                  </div>
                  {!groupMode && <Button size="sm" onClick={() => startDirect(u.id)}>Chat</Button>}
                </div>
              ))}
              {directory.length === 0 && <div className="p-4 text-center text-xs text-muted-foreground">No contacts available</div>}
            </ScrollArea>
            {groupMode && (
              <Button className="w-full" onClick={createNewGroup} disabled={!groupTitle.trim() || selected.length === 0}>Create group</Button>
            )}
          </div>
        </UIDialogContent>
      </UIDialog>

      {/* Forward message dialog */}
      <UIDialog open={!!forwarding} onOpenChange={(v) => !v && setForwarding(null)}>
        <UIDialogContent className="max-w-md">
          <UIDialogHeader><UIDialogTitle>Forward message</UIDialogTitle></UIDialogHeader>
          {forwarding && (
            <div className="space-y-3">
              <div className="rounded-lg border bg-muted/40 p-2 text-xs">
                <p className="mb-1 text-[10px] uppercase text-muted-foreground">Message</p>
                <p className="line-clamp-3 whitespace-pre-wrap">{forwarding.body || "(attachment)"}</p>
                {forwarding.attachments?.length > 0 && (
                  <p className="mt-1 text-[10px] text-muted-foreground">+ {forwarding.attachments.length} attachment(s)</p>
                )}
              </div>
              <p className="text-xs font-medium text-muted-foreground">Send to</p>
              <ScrollArea className="max-h-72 rounded-md border">
                {conversations.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted-foreground">No conversations available</div>
                ) : conversations.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleForward(c.id)}
                    className="flex w-full items-center gap-2 border-b p-2 text-left hover:bg-accent/50"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={directPeer(c)?.avatar_url ?? undefined} />
                      <AvatarFallback className="text-[10px]">{initials(conversationTitle(c))}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{conversationTitle(c) || "Chat"}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{c.type === "group" ? `${c.members?.length ?? 0} members` : c.type}</p>
                    </div>
                    <Forward className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                ))}
              </ScrollArea>
            </div>
          )}
        </UIDialogContent>
      </UIDialog>

      {/* Attachment lightbox */}
      <UIDialog open={!!lightbox} onOpenChange={(v) => !v && setLightbox(null)}>
        <UIDialogContent className="max-w-4xl border-0 bg-black/95 p-0 text-white sm:rounded-xl">
          {lightbox && (() => {
            const cur = lightbox.items[lightbox.index];
            const hasPrev = lightbox.index > 0;
            const hasNext = lightbox.index < lightbox.items.length - 1;
            return (
              <div className="relative flex h-[80vh] flex-col">
                <div className="flex items-center justify-between px-4 py-2 text-xs">
                  <span className="truncate">{cur.name} <span className="ml-2 opacity-60">{lightbox.index + 1} / {lightbox.items.length}</span></span>
                  <div className="flex items-center gap-1">
                    <a href={cur.url} target="_blank" rel="noreferrer" download className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/10" title="Open / download"><Download className="h-4 w-4" /></a>
                    <button type="button" onClick={() => setLightbox(null)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/10"><X className="h-4 w-4" /></button>
                  </div>
                </div>
                <div className="relative flex flex-1 items-center justify-center overflow-hidden px-4">
                  {cur.type.startsWith("video/") ? (
                    <video key={cur.url} src={cur.url} controls autoPlay className="max-h-full max-w-full rounded-md" />
                  ) : (
                    <img src={cur.url} alt={cur.name} className="max-h-full max-w-full rounded-md object-contain" />
                  )}
                  {hasPrev && (
                    <button type="button" onClick={() => setLightbox({ ...lightbox, index: lightbox.index - 1 })} className="absolute left-3 top-1/2 -translate-y-1/2 grid h-10 w-10 place-items-center rounded-full bg-white/10 backdrop-blur hover:bg-white/20"><ChevronLeft className="h-5 w-5" /></button>
                  )}
                  {hasNext && (
                    <button type="button" onClick={() => setLightbox({ ...lightbox, index: lightbox.index + 1 })} className="absolute right-3 top-1/2 -translate-y-1/2 grid h-10 w-10 place-items-center rounded-full bg-white/10 backdrop-blur hover:bg-white/20"><ChevronLeft className="h-5 w-5 rotate-180" /></button>
                  )}
                </div>
                {lightbox.items.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto border-t border-white/10 px-4 py-2">
                    {lightbox.items.map((it, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setLightbox({ ...lightbox, index: i })}
                        className={cn("relative h-14 w-20 shrink-0 overflow-hidden rounded border-2", i === lightbox.index ? "border-primary" : "border-transparent opacity-60 hover:opacity-100")}
                      >
                        {it.type.startsWith("video/") ? (
                          <>
                            <video src={it.url} className="h-full w-full object-cover" muted preload="metadata" />
                            <span className="absolute inset-0 grid place-items-center bg-black/30"><Film className="h-4 w-4" /></span>
                          </>
                        ) : (
                          <img src={it.url} alt={it.name} className="h-full w-full object-cover" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </UIDialogContent>
      </UIDialog>
    </div>
  );
}

function AttachmentPreview({ att }: { att: Attachment }) {
  const isImage = att.type?.startsWith("image/");
  if (isImage) {
    return <a href={att.url} target="_blank" rel="noreferrer"><img src={att.url} alt={att.name} className="max-h-48 rounded-md object-cover" /></a>;
  }
  return (
    <a href={att.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-md border bg-background/40 px-2 py-1 text-xs hover:bg-background/60">
      <FileText className="h-4 w-4 shrink-0" />
      <span className="truncate">{att.name}</span>
      <span className="ml-auto text-[10px] opacity-70">{Math.round(att.size / 1024)}KB</span>
    </a>
  );
}
