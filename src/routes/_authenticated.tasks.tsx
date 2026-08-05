import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ListChecks, Plus, Search, Loader2, Trash2, Pencil, Calendar, User as UserIcon,
  CheckCircle2, Circle, Clock, AlertOctagon, Sparkles, LayoutGrid, List as ListIcon, BellRing,
  MoreVertical, ChevronRight, MessageSquare, Paperclip, CheckSquare, History, Tag,
} from "lucide-react";
import { toast } from "sonner";
import {
  DndContext, DragOverlay, PointerSensor, KeyboardSensor, useSensor, useSensors,
  closestCenter, useDroppable, useDraggable, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import {
  listTasks, createTask, updateTask, deleteTask, listAssignableUsers, runTaskReminders,
  TASK_STATUSES, TASK_PRIORITIES, TASK_CATEGORIES, TASK_STATUS_LABELS, TASK_PRIORITY_LABELS, TASK_CATEGORY_LABELS,
  TASK_STATUS_STYLE, TASK_PRIORITY_STYLE,
  type Task, type TaskStatus, type TaskPriority, type TaskCategory, type TaskAssignee, type TaskInput,
} from "@/lib/tasks";
import { getUndoDurationMs } from "@/lib/undo-prefs";
import { showUndoToast } from "@/components/ui/undo-toast";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({
    meta: [
      { title: "Tasks · Faith AMS" },
      { name: "description", content: "Coordinate work across your Faith AMS teams — assign, track, and complete tasks." },
    ],
  }),
  component: () => (
    <RoleGuard roles={["admin", "counselor", "application_team"]}>
      <TasksPage />
    </RoleGuard>
  ),
});

const STATUS_ICON: Record<TaskStatus, typeof Circle> = {
  draft: Circle,
  todo: Circle,
  assigned: UserIcon,
  in_progress: Clock,
  waiting_for_student: UserIcon,
  waiting_for_documents: ListChecks,
  waiting_for_institution: ListChecks,
  waiting_for_payment: ListChecks,
  waiting_for_visa: ListChecks,
  under_review: Search,
  completed: CheckCircle2,
  cancelled: Circle,
  overdue: AlertOctagon,
  done: CheckCircle2,
};

type TabValue = "all" | TaskStatus | "mine";
type ViewMode = "list" | "board";

const FILTERS_KEY = "faith.tasks.filters.v1";

interface StoredFilters {
  tab: TabValue;
  priority: "all" | TaskPriority;
  view: ViewMode;
  search: string;
}

const DEFAULT_FILTERS: StoredFilters = { tab: "all", priority: "all", view: "list", search: "" };

function loadFilters(): StoredFilters {
  if (typeof window === "undefined") return DEFAULT_FILTERS;
  try {
    const raw = localStorage.getItem(FILTERS_KEY);
    if (!raw) return DEFAULT_FILTERS;
    return { ...DEFAULT_FILTERS, ...(JSON.parse(raw) as Partial<StoredFilters>) };
  } catch { return DEFAULT_FILTERS; }
}

function TasksPage() {
  const { user } = useAuth();
  const initial = loadFilters();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<TaskAssignee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(initial.search);
  const [tab, setTab] = useState<TabValue>(initial.tab);
  const [priority, setPriority] = useState<"all" | TaskPriority>(initial.priority);
  const [view, setView] = useState<ViewMode>(initial.view);
  const [editing, setEditing] = useState<Task | null>(null);
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState<Task | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Task | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // Persist filter/view choices
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(FILTERS_KEY, JSON.stringify({ tab, priority, view, search } satisfies StoredFilters));
  }, [tab, priority, view, search]);

  const load = async () => {
    setLoading(true);
    try {
      const [t, u] = await Promise.all([listTasks(), listAssignableUsers()]);
      setTasks(t); setUsers(u);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Fire due-date reminder scan on load and every 5 min
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const n = await runTaskReminders();
      if (!cancelled && n > 0) toast.message(`${n} task reminder${n === 1 ? "" : "s"} sent`, { icon: <BellRing className="h-4 w-4" /> });
    };
    tick();
    const id = setInterval(tick, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return tasks.filter((t) => {
      if (tab === "mine" && t.assignee_id !== user?.id) return false;
      if (tab === "overdue") {
        const isOverdue = !!((t.due_date && (t.status !== "completed" && t.status !== "done") && new Date(t.due_date) < new Date()) || t.status === "overdue");
        if (!isOverdue) return false;
      } else if (tab !== "all" && tab !== "mine" && t.status !== tab) return false;
      if (priority !== "all" && t.priority !== priority) return false;
      if (q && !(`${t.title} ${t.description ?? ""}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [tasks, tab, priority, search, user?.id]);

  const stats = useMemo(() => ({
    total: tasks.length,
    todo: tasks.filter((t) => t.status === "todo").length,
    inProgress: tasks.filter((t) => t.status === "in_progress").length,
    completed: tasks.filter((t) => t.status === "completed" || t.status === "done").length,
    overdue: tasks.filter((t) => (t.due_date && t.status !== "completed" && t.status !== "done" && new Date(t.due_date) < new Date()) || t.status === "overdue").length,
  }), [tasks]);

  const openNew = () => { setEditing(null); setOpen(true); };
  const openEdit = (t: Task) => { setEditing(t); setOpen(true); };

  const onSaveTask = async (patch: TaskInput) => {
    try {
      if (editing) {
        const prev = editing;
        await updateTask(editing.id, patch);
        setOpen(false);
        await load();

        // Detect assignee / priority changes for undo
        const changes: Array<{ field: "assignee" | "priority"; prevLabel: string; nextLabel: string; revert: Partial<TaskInput> }> = [];
        if (patch.priority && patch.priority !== prev.priority) {
          changes.push({
            field: "priority",
            prevLabel: TASK_PRIORITY_LABELS[prev.priority],
            nextLabel: TASK_PRIORITY_LABELS[patch.priority],
            revert: { priority: prev.priority },
          });
        }
        const prevAssignee = prev.assignee_id ?? null;
        const nextAssignee = patch.assignee_id ?? null;
        if (nextAssignee !== prevAssignee) {
          const prevUser = prevAssignee ? users.find((u) => u.id === prevAssignee) : null;
          const nextUser = nextAssignee ? users.find((u) => u.id === nextAssignee) : null;
          changes.push({
            field: "assignee",
            prevLabel: prevUser ? (prevUser.full_name || prevUser.email) : "Unassigned",
            nextLabel: nextUser ? (nextUser.full_name || nextUser.email) : "Unassigned",
            revert: { assignee_id: prevAssignee },
          });
        }

        if (changes.length === 0) {
          toast.success("Task updated");
        } else {
          const revertPatch: Partial<TaskInput> = changes.reduce((a, c) => ({ ...a, ...c.revert }), {});
          const summary = changes.length === 1
            ? `${changes[0].field === "priority" ? "Priority" : "Assignee"}: ${changes[0].prevLabel} → ${changes[0].nextLabel}`
            : changes.map((c) => `${c.field === "priority" ? "Priority" : "Assignee"} → ${c.nextLabel}`).join(" · ");
          showUndoToast({
            title: `Updated “${prev.title}”`,
            description: summary,
            undoLabel: `Revert ${changes.map((c) => c.field).join(" & ")}`,
            onUndo: async () => {
              try {
                await updateTask(prev.id, revertPatch as TaskInput);
                toast.success("Reverted");
                await load();
              } catch (e) { toast.error((e as Error).message); }
            },
            link: { label: "Open task", onClick: () => { setEditing(prev); setOpen(true); } },
          });
        }
      } else {
        await createTask(patch);
        toast.success("Task created");
        setOpen(false);
        await load();
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const onQuickStatus = async (t: Task, status: TaskStatus, opts?: { silent?: boolean }) => {
    if (t.status === status) return;
    const prevStatus = t.status;
    // optimistic
    setTasks((prev) => prev.map((x) => x.id === t.id ? { ...x, status } : x));
    try {
      await updateTask(t.id, { status });
      if (!opts?.silent) {
        showUndoToast({
          title: `Moved “${t.title}” to ${TASK_STATUS_LABELS[status]}`,
          description: `Was ${TASK_STATUS_LABELS[prevStatus]}`,
          undoLabel: `Revert to ${TASK_STATUS_LABELS[prevStatus]}`,
          onUndo: () => onQuickStatus({ ...t, status }, prevStatus, { silent: true }),
          link: { label: "Open task", onClick: () => { setEditing({ ...t, status }); setOpen(true); } },
        });
      }
    } catch (e) {
      setTasks((prev) => prev.map((x) => x.id === t.id ? { ...x, status: prevStatus } : x));
      toast.error((e as Error).message);
    }
  };


  const onDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteTask(confirmDelete.id);
      toast.success("Task deleted");
      setConfirmDelete(null);
      await load();
    } catch (e) { toast.error((e as Error).message); }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const draggingTask = useMemo(
    () => draggingId ? tasks.find((t) => t.id === draggingId) ?? null : null,
    [draggingId, tasks],
  );

  const onDragStart = (e: DragStartEvent) => setDraggingId(String(e.active.id));
  const onDragEnd = (e: DragEndEvent) => {
    setDraggingId(null);
    const overId = e.over?.id;
    const activeId = String(e.active.id);
    if (!overId) return;
    const task = tasks.find((t) => t.id === activeId);
    if (!task) return;
    const newStatus = String(overId) as TaskStatus;
    if (!TASK_STATUSES.includes(newStatus)) return;
    if (task.status !== newStatus) onQuickStatus(task, newStatus);
  };

  const clearFilters = () => {
    setSearch(""); setTab("all"); setPriority("all");
  };

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-card to-card p-5 shadow-sm sm:p-6">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-primary to-fuchsia-500 text-white shadow-md" aria-hidden>
              <ListChecks className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
              <p className="text-sm text-muted-foreground">Coordinate work across your teams</p>
            </div>
          </div>
          <Button onClick={openNew} size="lg" className="shadow-md">
            <Plus className="mr-2 h-4 w-4" aria-hidden />New task
          </Button>
        </div>

        <div className="relative mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Stat label="Total" value={stats.total} tone="primary" />
          <Stat label="To do" value={stats.todo} tone="slate" />
          <Stat label="In progress" value={stats.inProgress} tone="blue" />
          <Stat label="Done" value={stats.completed} tone="emerald" />
          <Stat label="Overdue" value={stats.overdue} tone="rose" />
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:p-4">
          <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)} className="flex-1 min-w-0">
            <TabsList className="w-full flex-wrap justify-start sm:w-auto" aria-label="Filter tasks by status">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="mine">Mine</TabsTrigger>
              {TASK_STATUSES.map((s) => (
                <TabsTrigger key={s} value={s}>{TASK_STATUS_LABELS[s]}</TabsTrigger>
              ))}
              <TabsTrigger value="overdue">Overdue</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
              <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tasks..."
                className="pl-9"
                aria-label="Search tasks"
              />
            </div>
            <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
              <SelectTrigger className="w-[130px]" aria-label="Filter by priority"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All priority</SelectItem>
                {TASK_PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>{TASK_PRIORITY_LABELS[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="inline-flex rounded-lg border bg-muted/40 p-0.5" role="group" aria-label="View mode">
              <button
                type="button"
                onClick={() => setView("list")}
                aria-pressed={view === "list"}
                aria-label="List view"
                className={cn(
                  "grid h-8 w-9 place-items-center rounded-md text-muted-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  view === "list" && "bg-background text-foreground shadow-sm",
                )}
              >
                <ListIcon className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => setView("board")}
                aria-pressed={view === "board"}
                aria-label="Board view"
                className={cn(
                  "grid h-8 w-9 place-items-center rounded-md text-muted-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  view === "board" && "bg-background text-foreground shadow-sm",
                )}
              >
                <LayoutGrid className="h-4 w-4" aria-hidden />
              </button>
            </div>
            {(tab !== "all" || priority !== "all" || search) && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>Clear</Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      {loading ? (
        <div className="grid place-items-center py-12" role="status" aria-label="Loading tasks">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
        </div>
      ) : filtered.length === 0 && view === "list" ? (
        <EmptyState
          icon={ListChecks}
          title="No tasks found"
          description={tasks.length === 0 ? "Create your first task to get started." : "Adjust filters to find what you're looking for."}
          action={tasks.length === 0 ? <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" aria-hidden />New task</Button> : undefined}
        />
      ) : view === "list" ? (
        <div className="grid gap-3" role="list" aria-label="Tasks">
          {filtered.map((t) => (
            <TaskListRow
              key={t.id}
              task={t}
              assignee={t.assignee_id ? userMap.get(t.assignee_id) ?? null : null}
              onToggleDone={() => onQuickStatus(t, (t.status === "completed" || t.status === "done") ? "todo" : "completed")}
              onEdit={() => openEdit(t)}
              onDelete={() => setConfirmDelete(t)}
              onStatusChange={(s) => onQuickStatus(t, s)}
            />
          ))}
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {TASK_STATUSES.map((s) => (
              <BoardColumn
                key={s}
                status={s}
                tasks={filtered.filter((t) => t.status === s)}
                users={userMap}
                onEdit={openEdit}
                onDelete={(t) => setConfirmDelete(t)}
                onStatusChange={onQuickStatus}
              />
            ))}
          </div>
          <DragOverlay>
            {draggingTask && (
              <div className="pointer-events-none w-72 rotate-1">
                <TaskCard task={draggingTask} assignee={draggingTask.assignee_id ? userMap.get(draggingTask.assignee_id) ?? null : null} compact />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      <TaskDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        users={users}
        onSave={onSaveTask}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(v) => { if (!v) setConfirmDelete(null); }}
        title="Delete this task?"
        description={confirmDelete?.title}
        confirmLabel="Delete"
        onConfirm={onDelete}
        variant="destructive"
      />
    </div>
  );
}

function TaskListRow({
  task: t, assignee, onToggleDone, onEdit, onDelete, onStatusChange,
}: {
  task: Task;
  assignee: TaskAssignee | null;
  onToggleDone: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (s: TaskStatus) => void;
}) {
  const Icon = STATUS_ICON[t.status];
  const overdue = !!((t.due_date && t.status !== "completed" && t.status !== "done" && new Date(t.due_date) < new Date()) || t.status === "overdue");

  return (
    <Card className={cn("group transition hover:shadow-md focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background", (t.status === "completed" || t.status === "done") && "opacity-70")} role="listitem">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
        <button
          onClick={onToggleDone}
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-lg border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            t.status === "completed" || t.status === "done" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600" :
              t.status === "in_progress" ? "border-blue-500/40 bg-blue-500/10 text-blue-600" :
                t.status === "overdue" ? "border-rose-500/40 bg-rose-500/10 text-rose-600" :
                  "border-border bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary",
          )}
          aria-label={t.status === "completed" || t.status === "done" ? `Mark ${t.title} as to do` : `Mark ${t.title} as done`}
          aria-pressed={t.status === "completed" || t.status === "done"}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={cn("font-semibold", (t.status === "completed" || t.status === "done") && "line-through text-muted-foreground")}>{t.title}</h3>
            <Badge className={cn("border", TASK_STATUS_STYLE[t.status])} variant="outline">
              {TASK_STATUS_LABELS[t.status]}
            </Badge>
            <Badge className={cn("border", TASK_PRIORITY_STYLE[t.priority])} variant="outline">
              {TASK_PRIORITY_LABELS[t.priority]}
            </Badge>
            {overdue && (
              <Badge variant="outline" className="border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300">
                Overdue
              </Badge>
            )}
          </div>
          {t.description && (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{t.description}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
            {t.category && (
              <span className="inline-flex items-center gap-1"><Tag className="h-3 w-3" aria-hidden />{TASK_CATEGORY_LABELS[t.category]}</span>
            )}
            {t.due_date && (
              <span className={cn("inline-flex items-center gap-1", overdue && "text-rose-600 font-medium")}><Calendar className="h-3 w-3" aria-hidden />{new Date(t.due_date).toLocaleDateString()}</span>
            )}
            {assignee && (
              <span className="inline-flex items-center gap-1"><UserIcon className="h-3 w-3" aria-hidden />{assignee.full_name || assignee.email}</span>
            )}
            {t.checklists && t.checklists.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <CheckSquare className="h-3 w-3" aria-hidden />
                {t.checklists.filter(c => c.is_completed).length}/{t.checklists.length}
              </span>
            )}
            {t.comments && t.comments.length > 0 && (
              <span className="inline-flex items-center gap-1"><MessageSquare className="h-3 w-3" aria-hidden />{t.comments.length}</span>
            )}
            {t.attachments && t.attachments.length > 0 && (
              <span className="inline-flex items-center gap-1"><Paperclip className="h-3 w-3" aria-hidden />{t.attachments.length}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Select value={t.status} onValueChange={(v) => onStatusChange(v as TaskStatus)}>
            <SelectTrigger className="h-8 w-[130px] text-xs" aria-label={`Status for ${t.title}`}><SelectValue /></SelectTrigger>
            <SelectContent>
              {TASK_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{TASK_STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="icon" variant="ghost" onClick={onEdit} aria-label={`Edit task ${t.title}`}><Pencil className="h-4 w-4" aria-hidden /></Button>
          <Button size="icon" variant="ghost" onClick={onDelete} aria-label={`Delete task ${t.title}`}><Trash2 className="h-4 w-4 text-destructive" aria-hidden /></Button>
        </div>
      </CardContent>
    </Card>
  );
}

function BoardColumn({
  status, tasks, users, onEdit, onDelete, onStatusChange,
}: {
  status: TaskStatus;
  tasks: Task[];
  users: Map<string, TaskAssignee>;
  onEdit: (t: Task) => void;
  onDelete: (t: Task) => void;
  onStatusChange: (t: Task, s: TaskStatus) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const Icon = STATUS_ICON[status];
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-[240px] flex-col gap-2 rounded-2xl border bg-card/40 p-3 transition",
        isOver && "border-primary bg-primary/5 ring-2 ring-primary/40",
      )}
      aria-label={`${TASK_STATUS_LABELS[status]} column`}
    >
      <div className="flex items-center justify-between px-1 pb-1">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
          <h2 className="text-sm font-semibold">{TASK_STATUS_LABELS[status]}</h2>
        </div>
        <Badge variant="outline" className="h-5 px-1.5 text-[10px]">{tasks.length}</Badge>
      </div>
      {tasks.length === 0 ? (
        <div className="grid flex-1 place-items-center rounded-xl border border-dashed py-8 text-xs text-muted-foreground">
          Drop tasks here
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {tasks.map((t) => (
            <DraggableTaskCard
              key={t.id}
              task={t}
              assignee={t.assignee_id ? users.get(t.assignee_id) ?? null : null}
              onEdit={() => onEdit(t)}
              onDelete={() => onDelete(t)}
              onStatusChange={(s) => onStatusChange(t, s)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DraggableTaskCard({
  task, assignee, onEdit, onDelete, onStatusChange,
}: {
  task: Task;
  assignee: TaskAssignee | null;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (s: TaskStatus) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn("cursor-grab touch-none active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl", isDragging && "opacity-40")}
      aria-label={`Drag task ${task.title}. Current status ${TASK_STATUS_LABELS[task.status]}.`}
    >
      <TaskCard task={task} assignee={assignee} onEdit={onEdit} onDelete={onDelete} onStatusChange={onStatusChange} />
    </div>
  );
}

function TaskCard({
  task: t, assignee, compact, onEdit, onDelete, onStatusChange,
}: {
  task: Task;
  assignee: TaskAssignee | null;
  compact?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onStatusChange?: (s: TaskStatus) => void;
}) {
  const overdue = !!((t.due_date && t.status !== "completed" && t.status !== "done" && new Date(t.due_date) < new Date()) || t.status === "overdue");
  return (
    <div className={cn("rounded-xl border bg-background p-3 shadow-sm transition hover:shadow-md", compact && "shadow-lg")}>
      <div className="flex items-start justify-between gap-2">
        <h3 className={cn("text-sm font-semibold leading-snug", (t.status === "completed" || t.status === "done") && "line-through text-muted-foreground")}>{t.title}</h3>
        <Badge variant="outline" className={cn("shrink-0 border text-[10px]", TASK_PRIORITY_STYLE[t.priority])}>
          {TASK_PRIORITY_LABELS[t.priority]}
        </Badge>
      </div>
      {t.description && !compact && (
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{t.description}</p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        {t.due_date && (
          <span className={cn("inline-flex items-center gap-1", overdue && "text-rose-600 dark:text-rose-400 font-medium")}>
            <Calendar className="h-3 w-3" aria-hidden />{new Date(t.due_date).toLocaleDateString()}
          </span>
        )}
        {assignee && (
          <span className="inline-flex items-center gap-1"><UserIcon className="h-3 w-3" aria-hidden />{assignee.full_name || assignee.email}</span>
        )}
        {overdue && <Badge variant="outline" className="h-4 border-rose-500/30 bg-rose-500/10 px-1 text-[9px] text-rose-700 dark:text-rose-300">Overdue</Badge>}
      </div>
      {!compact && (onEdit || onDelete || onStatusChange) && (
        <div
          className="mt-2 flex items-center gap-1"
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {onStatusChange && (
            <Select value={t.status} onValueChange={(v) => onStatusChange(v as TaskStatus)}>
              <SelectTrigger className="h-7 w-full text-[11px]" aria-label={`Status for ${t.title}`}><SelectValue /></SelectTrigger>
              <SelectContent>
                {TASK_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{TASK_STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {onEdit && <Button size="icon" variant="ghost" onClick={onEdit} aria-label={`Edit task ${t.title}`} className="h-7 w-7"><Pencil className="h-3.5 w-3.5" aria-hidden /></Button>}
          {onDelete && <Button size="icon" variant="ghost" onClick={onDelete} aria-label={`Delete task ${t.title}`} className="h-7 w-7"><Trash2 className="h-3.5 w-3.5 text-destructive" aria-hidden /></Button>}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "primary" | "slate" | "blue" | "emerald" | "rose" }) {
  const styles: Record<typeof tone, string> = {
    primary: "from-primary/20 to-primary/5 text-primary",
    slate: "from-slate-500/20 to-slate-500/5 text-slate-700 dark:text-slate-300",
    blue: "from-blue-500/20 to-blue-500/5 text-blue-700 dark:text-blue-300",
    emerald: "from-emerald-500/20 to-emerald-500/5 text-emerald-700 dark:text-emerald-300",
    rose: "from-rose-500/20 to-rose-500/5 text-rose-700 dark:text-rose-300",
  };
  return (
    <div className={cn("rounded-xl border bg-gradient-to-br p-3 backdrop-blur", styles[tone])}>
      <p className="text-[10px] font-semibold uppercase tracking-wider">{label}</p>
      <p className="mt-0.5 text-2xl font-bold">{value}</p>
    </div>
  );
}

function TaskDialog({
  open, onOpenChange, editing, users, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Task | null;
  users: TaskAssignee[];
  onSave: (patch: TaskInput) => Promise<void>;
}) {
  const [form, setForm] = useState<TaskInput>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(editing ? {
      title: editing.title, description: editing.description,
      status: editing.status, priority: editing.priority, category: editing.category,
      due_date: editing.due_date, start_date: editing.start_date,
      reminder_date: editing.reminder_date, reminder_time: editing.reminder_time,
      assignee_id: editing.assignee_id,
    } : { status: "todo", priority: "normal", category: "internal" });
  }, [open, editing]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title?.trim()) return;
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden />
            {editing ? "Edit task" : "New task"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title *</Label>
            <Input id="title" required autoFocus value={form.title ?? ""} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="desc">Description</Label>
            <Textarea id="desc" rows={3} value={form.description ?? ""} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="task-status">Status</Label>
              <Select value={form.status ?? "todo"} onValueChange={(v) => setForm((f) => ({ ...f, status: v as TaskStatus }))}>
                <SelectTrigger id="task-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_STATUSES.map((s) => <SelectItem key={s} value={s}>{TASK_STATUS_LABELS[s]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-category">Category</Label>
              <Select value={form.category ?? "internal"} onValueChange={(v) => setForm((f) => ({ ...f, category: v as TaskCategory }))}>
                <SelectTrigger id="task-category"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{TASK_CATEGORY_LABELS[c]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-priority">Priority</Label>
              <Select value={form.priority ?? "normal"} onValueChange={(v) => setForm((f) => ({ ...f, priority: v as TaskPriority }))}>
                <SelectTrigger id="task-priority"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map((p) => <SelectItem key={p} value={p}>{TASK_PRIORITY_LABELS[p]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-assignee">Assignee</Label>
              <Select value={form.assignee_id ?? "none"} onValueChange={(v) => setForm((f) => ({ ...f, assignee_id: v === "none" ? null : v }))}>
                <SelectTrigger id="task-assignee"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 border-t pt-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="start">Start date</Label>
              <Input id="start" type="date" value={form.start_date ?? ""} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value || null }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="due">Due date</Label>
              <Input id="due" type="date" value={form.due_date ?? ""} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value || null }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reminder-date">Reminder date</Label>
              <Input id="reminder-date" type="date" value={form.reminder_date ?? ""} onChange={(e) => setForm((f) => ({ ...f, reminder_date: e.target.value || null }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reminder-time">Reminder time</Label>
              <Input id="reminder-time" type="time" value={form.reminder_time ?? ""} onChange={(e) => setForm((f) => ({ ...f, reminder_time: e.target.value || null }))} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
              {editing ? "Save changes" : "Create task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
