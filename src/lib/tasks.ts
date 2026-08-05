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

export async function listTasks(filters?: any): Promise<Task[]> {
  // Fix the relationship by joining on user_id to profiles directly if possible, 
  // or handle the potential missing relation error.
  let query = supabase.from("tasks").select(`
    *,
    assignees:task_assignees(user_id),
    followers:task_followers(user_id),
    checklists:task_checklists(*),
    dependencies:task_dependencies(depends_on_task_id),
    attachments:task_attachments(*)
  `);
  
  if (filters?.assignee_id) {
    query = query.eq("assignee_id", filters.assignee_id);
  }
  
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;

  // Manually fetch comments to avoid the specific profile relationship issue in the main join
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

export async function listAssignableUsers() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url")
    .order("full_name", { ascending: true });
  if (error) return [];
  return data ?? [];
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
