import { supabase } from "./supabase";

export type ConversationType = "direct" | "group" | "application";

export interface Conversation {
  id: string;
  type: ConversationType;
  title: string | null;
  application_id: string | null;
  last_message_at: string;
  created_at: string;
  last_read_at: string | null;
  unread_count: number;
  members: { user_id: string; role: string }[] | null;
  last_message: { id: string; body: string | null; sender_id: string | null; created_at: string; attachments: any } | null;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  body: string | null;
  attachments: Attachment[];
  reply_to_id: string | null;
  edited_at: string | null;
  deleted_at: string | null;
  pinned: boolean;
  created_at: string;
}

export interface Attachment {
  name: string;
  path: string;
  url: string;
  size: number;
  type: string;
}

export interface DirectoryUser {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  status: string | null;
}

const MAX_FILE_MB = 20;
const ALLOWED_MIME = [
  "image/png","image/jpeg","image/jpg","image/webp","image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip","application/x-zip-compressed",
  "text/plain",
];

export async function listMyConversations(): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from("my_conversations_view")
    .select("*")
    .order("last_message_at", { ascending: false });
  if (error) throw error;
  return (data as Conversation[]) ?? [];
}

export async function listMessages(conversationId: string, before?: string, limit = 50): Promise<Message[]> {
  let q = supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (before) q = q.lt("created_at", before);
  const { data, error } = await q;
  if (error) throw error;
  return ((data as Message[]) ?? []).reverse();
}

export async function sendMessage(conversationId: string, body: string, attachments: Attachment[] = [], replyToId?: string) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not signed in");
  const { data, error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: u.user.id,
    body: body || null,
    attachments,
    reply_to_id: replyToId ?? null,
  }).select("*").single();
  if (error) throw error;
  return data as Message;
}

export async function editMessage(id: string, body: string) {
  const { error } = await supabase.from("messages").update({ body, edited_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function deleteMessage(id: string) {
  const { error } = await supabase.from("messages").update({ deleted_at: new Date().toISOString(), body: null, attachments: [] }).eq("id", id);
  if (error) throw error;
}

export async function togglePin(id: string, pinned: boolean) {
  const { error } = await supabase.from("messages").update({ pinned }).eq("id", id);
  if (error) throw error;
}

export async function toggleStar(messageId: string, starred: boolean) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not signed in");
  if (starred) {
    await supabase.from("message_stars").insert({ message_id: messageId, user_id: u.user.id });
  } else {
    await supabase.from("message_stars").delete().eq("message_id", messageId).eq("user_id", u.user.id);
  }
}

export async function reactToMessage(messageId: string, emoji: string) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not signed in");
  // toggle
  const { data: existing } = await supabase.from("message_reactions")
    .select("*").eq("message_id", messageId).eq("user_id", u.user.id).eq("emoji", emoji).maybeSingle();
  if (existing) {
    await supabase.from("message_reactions").delete().eq("message_id", messageId).eq("user_id", u.user.id).eq("emoji", emoji);
  } else {
    await supabase.from("message_reactions").insert({ message_id: messageId, user_id: u.user.id, emoji });
  }
}

export async function listReactions(messageIds: string[]) {
  if (!messageIds.length) return [];
  const { data, error } = await supabase.from("message_reactions").select("*").in("message_id", messageIds);
  if (error) throw error;
  return data ?? [];
}

export async function markConversationRead(conversationId: string) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;
  await supabase.from("conversation_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId).eq("user_id", u.user.id);
}

export async function hideConversation(conversationId: string) {
  const { error } = await supabase.rpc("hide_conversation", { _cid: conversationId });
  if (error) throw error;
}

export async function unhideConversation(conversationId: string) {
  const { error } = await supabase.rpc("unhide_conversation", { _cid: conversationId });
  if (error) throw error;
}

export async function getOrCreateDirect(otherUserId: string): Promise<string> {
  const { data, error } = await supabase.rpc("get_or_create_direct_conversation", { _other: otherUserId });
  if (error) throw error;
  return data as string;
}

export async function getOrCreateApplicationChat(applicationId: string): Promise<string> {
  const { data, error } = await supabase.rpc("get_or_create_application_conversation", { _app: applicationId });
  if (error) throw error;
  return data as string;
}

export async function createGroup(title: string, memberIds: string[]): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not signed in");
  const { data: conv, error } = await supabase.from("conversations")
    .insert({ type: "group", title, created_by: u.user.id }).select("id").single();
  if (error) throw error;
  const cid = (conv as any).id as string;
  const rows = Array.from(new Set([u.user.id, ...memberIds])).map((uid) => ({
    conversation_id: cid, user_id: uid, role: uid === u.user!.id ? "owner" : "member",
  }));
  const { error: mErr } = await supabase.from("conversation_members").insert(rows);
  if (mErr) throw mErr;
  return cid;
}

export async function addMembers(conversationId: string, memberIds: string[]) {
  const rows = memberIds.map((uid) => ({ conversation_id: conversationId, user_id: uid }));
  const { error } = await supabase.from("conversation_members").insert(rows);
  if (error) throw error;
}

export async function leaveConversation(conversationId: string) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;
  await supabase.from("conversation_members").delete()
    .eq("conversation_id", conversationId).eq("user_id", u.user.id);
}

/**
 * Chat directory: every non-student user (excluding self and inactive),
 * with online status. Uses SECURITY DEFINER RPC so any signed-in user can
 * browse the roster without broad SELECT on profiles.
 */
export async function listChatDirectory(
  _currentRoles: string[],
  _currentUserId: string,
  opts: { search?: string; limit?: number; offset?: number } = {},
): Promise<DirectoryUser[]> {
  const { data, error } = await supabase.rpc("chat_directory", {
    _search: opts.search ?? null,
    _limit: opts.limit ?? 100,
    _offset: opts.offset ?? 0,
  });
  if (error) throw error;
  return ((data as any[]) ?? []).map((r) => ({
    id: r.id,
    email: r.email,
    full_name: r.full_name,
    avatar_url: r.avatar_url,
    status: r.is_online ? "online" : "offline",
  }));
}

export interface DirectoryPerson extends DirectoryUser {
  is_online: boolean;
  last_seen_at: string | null;
}

export async function listChatPeople(
  opts: { search?: string; limit?: number; offset?: number } = {},
): Promise<DirectoryPerson[]> {
  const { data, error } = await supabase.rpc("chat_directory", {
    _search: opts.search ?? null,
    _limit: opts.limit ?? 100,
    _offset: opts.offset ?? 0,
  });
  if (error) throw error;
  return ((data as any[]) ?? []).map((r) => ({
    id: r.id,
    email: r.email,
    full_name: r.full_name,
    avatar_url: r.avatar_url,
    status: r.is_online ? "online" : "offline",
    is_online: !!r.is_online,
    last_seen_at: r.last_seen_at ?? null,
  }));
}

export interface GlobalSearchHit {
  kind: "conversation" | "message" | "user" | "application";
  id: string;
  conversation_id: string | null;
  title: string | null;
  snippet: string | null;
  avatar_url: string | null;
  application_id: string | null;
  created_at: string;
}

export async function searchAll(term: string, opts: { limit?: number; offset?: number } = {}): Promise<GlobalSearchHit[]> {
  if (!term.trim()) return [];
  const { data, error } = await supabase.rpc("chat_search", {
    _q: term.trim(),
    _limit: opts.limit ?? 25,
    _offset: opts.offset ?? 0,
  });
  if (error) throw error;
  return (data as GlobalSearchHit[]) ?? [];
}


export async function uploadAttachment(conversationId: string, file: File): Promise<Attachment> {
  if (file.size > MAX_FILE_MB * 1024 * 1024) throw new Error(`File exceeds ${MAX_FILE_MB}MB limit`);
  if (file.type && !ALLOWED_MIME.includes(file.type)) throw new Error("File type not allowed");
  const path = `${conversationId}/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
  const { error } = await supabase.storage.from("chat-attachments").upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw error;
  const { data: signed } = await supabase.storage.from("chat-attachments").createSignedUrl(path, 60 * 60 * 24 * 7);
  return { name: file.name, path, url: signed?.signedUrl ?? "", size: file.size, type: file.type };
}

export async function refreshAttachmentUrl(path: string): Promise<string> {
  const { data } = await supabase.storage.from("chat-attachments").createSignedUrl(path, 60 * 60 * 24 * 7);
  return data?.signedUrl ?? "";
}

export async function upsertMyPresence(status: "online" | "away" | "offline") {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;
  await supabase.from("user_presence").upsert({
    user_id: u.user.id, status, last_seen_at: new Date().toISOString(),
  });
}

export async function listPresence(userIds: string[]) {
  if (!userIds.length) return [];
  const { data } = await supabase.from("user_presence").select("*").in("user_id", userIds);
  return data ?? [];
}

export async function searchMessages(term: string, limit = 30) {
  if (!term.trim()) return [];
  const { data, error } = await supabase.from("messages")
    .select("*").ilike("body", `%${term}%`).is("deleted_at", null)
    .order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return (data as Message[]) ?? [];
}
