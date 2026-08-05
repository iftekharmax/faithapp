import { supabase } from "./supabase";

export type TaskStatus = 
  | "draft" 
  | "todo" 
  | "assigned" 
  | "in_progress" 
  | "waiting_for_student" 
  | "waiting_for_documents" 
  | "waiting_for_institution" 
  | "waiting_for_payment" 
  | "waiting_for_visa" 
  | "under_review" 
  | "completed" 
  | "cancelled" 
  | "overdue"
  | "done";

export type TaskPriority = "low" | "normal" | "high" | "urgent" | "critical";

export type TaskCategory = 
  | "student" 
  | "application" 
  | "document" 
  | "visa" 
  | "finance" 
  | "compliance" 
  | "follow_up" 
  | "internal" 
  | "team" 
  | "reminder" 
  | "custom";

export interface TaskChecklistItem {
  id: string;
  task_id: string;
  title: string;
  is_completed: boolean;
  position: number;
  created_at: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  user_id: string | null;
  content: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
  user?: {
    full_name: string | null;
    avatar_url: string | null;
  };
}

export interface TaskAttachment {
  id: string;
  task_id: string;
  comment_id: string | null;
  user_id: string | null;
  file_name: string;
  file_path: string;
  file_size: number | null;
  file_type: string | null;
  created_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  category: TaskCategory;
  due_date: string | null;
  start_date: string | null;
  reminder_date: string | null;
  reminder_time: string | null;
  assignee_id: string | null;
  assigned_by: string | null;
  department_id: string | null;
  application_id: string | null;
  student_id: string | null;
  parent_task_id: string | null;
  estimated_hours: number | null;
  actual_hours: number | null;
  completion_percentage: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  
  // Relations
  assignees?: { user_id: string }[];
  followers?: { user_id: string }[];
  checklists?: TaskChecklistItem[];
  comments?: TaskComment[];
  attachments?: TaskAttachment[];
  subtasks?: Task[];
  dependencies?: { depends_on_task_id: string }[];
  is_blocked?: boolean;
}

export type TaskInput = Partial<Omit<Task, "id" | "created_at" | "updated_at" | "completed_at">>;

export const TASK_STATUSES: TaskStatus[] = [
  "draft", "todo", "assigned", "in_progress", "waiting_for_student", 
  "waiting_for_documents", "waiting_for_institution", "waiting_for_payment", 
  "waiting_for_visa", "under_review", "completed", "cancelled", "overdue"
];

export const TASK_PRIORITIES: TaskPriority[] = ["low", "normal", "high", "urgent", "critical"];

export const TASK_CATEGORIES: TaskCategory[] = [
  "student", "application", "document", "visa", "finance", 
  "compliance", "follow_up", "internal", "team", "reminder", "custom"
];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  draft: "Draft",
  todo: "To Do",
  assigned: "Assigned",
  in_progress: "In Progress",
  waiting_for_student: "Waiting for Student",
  waiting_for_documents: "Waiting for Documents",
  waiting_for_institution: "Waiting for Institution",
  waiting_for_payment: "Waiting for Payment",
  waiting_for_visa: "Waiting for Visa",
  under_review: "Under Review",
  completed: "Completed",
  cancelled: "Cancelled",
  overdue: "Overdue",
  done: "Done",
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
  critical: "Critical",
};

export const TASK_CATEGORY_LABELS: Record<TaskCategory, string> = {
  student: "Student Task",
  application: "Application Task",
  document: "Document Task",
  visa: "Visa Task",
  finance: "Finance Task",
  compliance: "Compliance Task",
  follow_up: "Follow-up Task",
  internal: "Internal Task",
  team: "Team Task",
  reminder: "Reminder Task",
  custom: "Custom Task",
};

export const TASK_STATUS_STYLE: Record<TaskStatus, string> = {
  draft: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20",
  todo: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20",
  assigned: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20",
  in_progress: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
  waiting_for_student: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
  waiting_for_documents: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
  waiting_for_institution: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
  waiting_for_payment: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
  waiting_for_visa: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
  under_review: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20",
  completed: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  cancelled: "bg-slate-500/10 text-slate-500 border-slate-500/20",
  overdue: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20",
  done: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
};

export const TASK_PRIORITY_STYLE: Record<TaskPriority, string> = {
  low: "bg-muted text-muted-foreground border-border",
  normal: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
  high: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
  urgent: "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20",
  critical: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20",
};

export interface TaskAssignee {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url?: string | null;
}

export async function listTasks(filters?: any): Promise<Task[]> {
  let query = supabase.from("tasks").select(`
    *,
    assignees:task_assignees(user_id),
    followers:task_followers(user_id),
    checklists:task_checklists(*),
    task_dependencies!task_dependencies_task_id_fkey(depends_on_task_id),
    attachments:task_attachments(*)
  `);
  
  if (filters?.assignee_id) {
    query = query.eq("assignee_id", filters.assignee_id);
  }
  
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;

  const taskIds = data?.map(t => t.id) || [];
  if (taskIds.length > 0) {
    const { data: comments } = await supabase
      .from("task_comments")
      .select("*, user_profile:profiles!task_comments_user_id_fkey(full_name, avatar_url)")
      .in("task_id", taskIds);
    
    if (comments) {
      data.forEach(task => {
        task.comments = comments
          .filter(c => c.task_id === task.id)
          .map(c => ({
            ...c,
            user: c.user_profile
          }));
      });
    }
  }

  return (data as Task[]) ?? [];
}

export async function createTask(input: TaskInput): Promise<Task> {
  const { data: sess } = await supabase.auth.getUser();
  const payload = { ...input, assigned_by: sess.user?.id ?? null };
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

export async function listAssignableUsers(): Promise<TaskAssignee[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url")
    .order("full_name", { ascending: true });
  if (error) return [];
  return (data as TaskAssignee[]) ?? [];
}

export async function runTaskReminders(): Promise<number> {
  try {
    const { data, error } = await supabase.rpc("run_task_reminders");
    if (error) return 0;
    return (data as number) ?? 0;
  } catch {
    return 0;
  }
}

export async function listWorkflowTemplates() {
  const { data, error } = await supabase
    .from("task_workflow_templates")
    .select("*, steps:task_workflow_steps(*)");
  if (error) return [];
  return data ?? [];
}
