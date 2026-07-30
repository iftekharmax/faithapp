import { supabase } from "./supabase";

export type TaskStatus = "todo" | "in_progress" | "blocked" | "done";
export type TaskPriority = "low" | "normal" | "high" | "urgent";

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  assignee_id: string | null;
  created_by: string | null;
  application_id: string | null;
  student_id: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type TaskInput = Partial<Omit<Task, "id" | "created_at" | "updated_at" | "completed_at">>;

export const TASK_STATUSES: TaskStatus[] = ["todo", "in_progress", "blocked", "done"];
export const TASK_PRIORITIES: TaskPriority[] = ["low", "normal", "high", "urgent"];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  blocked: "Blocked",
  done: "Done",
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

export const TASK_STATUS_STYLE: Record<TaskStatus, string> = {
  todo: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20",
  in_progress: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
  blocked: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20",
  done: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
};

export const TASK_PRIORITY_STYLE: Record<TaskPriority, string> = {
  low: "bg-muted text-muted-foreground border-border",
  normal: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
  high: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
  urgent: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20",
};

export async function listTasks(): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as Task[]) ?? [];
}

export async function createTask(input: TaskInput): Promise<Task> {
  const { data: sess } = await supabase.auth.getUser();
  const payload = { ...input, created_by: sess.user?.id ?? null };
  const { data, error } = await supabase.from("tasks").insert(payload).select("*").single();
  if (error) throw error;
  return data as Task;
}

export async function updateTask(id: string, patch: TaskInput): Promise<Task> {
  const { data, error } = await supabase.from("tasks").update(patch).eq("id", id).select("*").single();
  if (error) throw error;
  return data as Task;
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw error;
}

export interface TaskAssignee {
  id: string;
  full_name: string | null;
  email: string;
}

export async function listAssignableUsers(): Promise<TaskAssignee[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .order("full_name", { ascending: true });
  if (error) return [];
  return (data as TaskAssignee[]) ?? [];
}

// Trigger server-side due-date reminder scan for the current user.
// Silent no-op on error so it never blocks the UI.
export async function runTaskReminders(): Promise<number> {
  try {
    const { data, error } = await supabase.rpc("run_task_reminders");
    if (error) return 0;
    return (data as number) ?? 0;
  } catch {
    return 0;
  }
}
