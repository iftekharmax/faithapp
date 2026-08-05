import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  ListChecks, Plus, Search, Loader2, Trash2, Pencil, Calendar, User as UserIcon,
  CheckCircle2, Circle, Clock, AlertOctagon, Sparkles, LayoutGrid, List as ListIcon, BellRing,
  MoreVertical, ChevronRight, MessageSquare, Paperclip, CheckSquare, History, Tag, ChevronDown,
  ChevronLeft, Settings2, UserPlus,
} from "lucide-react";
import { WorkflowSelector } from "@/components/tasks/WorkflowSelector";

import { toast } from "sonner";
import {
  Calendar as BigCalendar,
  dateFnsLocalizer,
  type View as BigView,
  Views,
} from "react-big-calendar";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale";

import "react-big-calendar/lib/css/react-big-calendar.css";


import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import {
  listTasks, createTask, updateTask, deleteTask, listAssignableUsers, runTaskReminders,
  TASK_STATUSES, TASK_PRIORITIES, TASK_CATEGORIES, TASK_STATUS_LABELS, TASK_PRIORITY_LABELS, TASK_CATEGORY_LABELS,
  TASK_STATUS_STYLE, TASK_PRIORITY_STYLE,
  type Task, type TaskStatus, type TaskPriority, type TaskCategory, type TaskAssignee, type TaskInput,
  initiateWorkflow, logTaskAction,
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

type TabValue = "all" | TaskStatus | "mine" | "calendar";
type ViewMode = "list" | "board";

const FILTERS_KEY = "faith.tasks.filters.v1";

const locales = { "en-US": enUS };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

const DnDCalendar = withDragAndDrop(BigCalendar);



interface StoredFilters {
  tab: TabValue;
  priority: "all" | TaskPriority;
  view: ViewMode;
  search: string;
}

const DEFAULT_FILTERS: StoredFilters = { tab: "all", priority: "all", view: "list", search: "" };

type WorkflowType = 'Australia Student' | 'UK Student' | 'Canada Student' | 'USA Student' | 'Bachelor' | 'Masters' | 'Visa Processing' | 'Finance';


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
  const [department, setDepartment] = useState<string>("all");
  const [view, setView] = useState<ViewMode>(initial.view);
  const [editing, setEditing] = useState<Task | null>(null);
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState<Task | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Task | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [savedFilters, setSavedFilters] = useState<Array<{ name: string; filters: any }>>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem("faith.tasks.saved_filters");
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });

  const saveCurrentFilter = (name: string) => {
    const newPreset = { name, filters: { tab, priority, search, department } };
    const updated = [...savedFilters, newPreset];
    setSavedFilters(updated);
    localStorage.setItem("faith.tasks.saved_filters", JSON.stringify(updated));
    toast.success(`Filter "${name}" saved`);
  };

  const applyPreset = (preset: any) => {
    if (preset.filters.tab) setTab(preset.filters.tab);
    if (preset.filters.priority) setPriority(preset.filters.priority);
    if (preset.filters.search !== undefined) setSearch(preset.filters.search);
    if (preset.filters.department) setDepartment(preset.filters.department);
    toast.success(`Applied preset: ${preset.name}`);
  };

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
        const isOverdue = !!((t.due_date && t.status !== "done" && new Date(t.due_date) < new Date()) || t.status === "overdue");
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
    completed: tasks.filter((t) => t.status === "done").length,
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
          undoLabel: "Undo Change",
          onUndo: () => onQuickStatus({ ...t, status }, prevStatus, { silent: true }),
          link: { label: "Open task", onClick: () => { setViewing({ ...t, status }); } },
        });
      }
    } catch (e) {
      setTasks((prev) => prev.map((x) => x.id === t.id ? { ...x, status: prevStatus } : x));
      toast.error((e as Error).message);
    }
  };

  const onQuickAssign = async (t: Task, assigneeId: string | null) => {
    const prevAssigneeId = t.assignee_id;
    if (prevAssigneeId === assigneeId) return;
    
    // optimistic
    setTasks((prev) => prev.map((x) => x.id === t.id ? { ...x, assignee_id: assigneeId } : x));
    
    try {
      await updateTask(t.id, { assignee_id: assigneeId });
      const nextUser = assigneeId ? users.find(u => u.id === assigneeId) : null;
      showUndoToast({
        title: `Assigned “${t.title}”`,
        description: nextUser ? `Assigned to ${nextUser.full_name || nextUser.email}` : "Task unassigned",
        undoLabel: "Undo Assign",
        onUndo: () => onQuickAssign({ ...t, assignee_id: assigneeId }, prevAssigneeId),
      });
    } catch (e) {
      setTasks((prev) => prev.map((x) => x.id === t.id ? { ...x, assignee_id: prevAssigneeId } : x));
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
  const onDragEnd = async (e: DragEndEvent) => {
    setDraggingId(null);
    const overId = e.over?.id;
    const activeId = String(e.active.id);
    if (!overId) return;
    const task = tasks.find((t) => t.id === activeId);
    if (!task) return;
    const newStatus = String(overId) as TaskStatus;
    if (!TASK_STATUSES.includes(newStatus)) return;
    if (task.status !== newStatus) {
      await onQuickStatus(task, newStatus);
      await logTaskAction(task.id, "board_move", { from: task.status, to: newStatus });
    }
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
          <div className="flex items-center gap-2">
            <WorkflowSelector onSelect={async (template, config) => {
              try {
                await initiateWorkflow(template, config);
                toast.success(`Workflow "${template}" initiated`);
                await load();
              } catch (e) {
                toast.error((e as Error).message);
              }
            }} />
            <Button onClick={openNew} size="lg" className="shadow-md">

              <Plus className="mr-2 h-4 w-4" aria-hidden />New task
            </Button>
          </div>

        </div>

        <div className="relative mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          <Stat label="My Tasks" value={tasks.filter(t => t.assignee_id === user?.id).length} tone="primary" />
          <Stat label="Pending" value={tasks.filter(t => t.status !== "done").length} tone="slate" />
          <Stat label="Waiting" value={tasks.filter(t => t.status.startsWith('waiting_')).length} tone="blue" />
          <Stat label="Overdue" value={tasks.filter(t => (t.due_date && t.status !== "done" && new Date(t.due_date) < new Date()) || t.status === "overdue").length} tone="rose" />
          <Stat label="Urgent" value={tasks.filter(t => t.priority === "urgent" || t.priority === "critical").length} tone="rose" />
          <Stat label="Done" value={tasks.filter(t => t.status === "done").length} tone="emerald" />
        </div>
      </div>

      {/* Advanced Filters */}
      <Card className="border-none shadow-sm bg-card/50 backdrop-blur">
        <CardContent className="p-4 flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
             <div className="relative w-full sm:max-w-xs">
                <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search tasks..."
                  className="pl-9 h-9"
                  aria-label="Search tasks"
                />
              </div>
              
              <Select value={tab} onValueChange={(v) => setTab(v as TabValue)}>
                <SelectTrigger className="w-[140px] h-9" aria-label="Status filter"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="mine">My Tasks</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <DropdownMenuSeparator />
                  {TASK_STATUSES.map(s => <SelectItem key={s} value={s}>{TASK_STATUS_LABELS[s]}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
                <SelectTrigger className="w-[140px] h-9" aria-label="Priority filter"><SelectValue placeholder="Priority" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  {TASK_PRIORITIES.map(p => <SelectItem key={p} value={p}>{TASK_PRIORITY_LABELS[p]}</SelectItem>)}
                </SelectContent>
              </Select>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 gap-2">
                    <Settings2 className="h-4 w-4" /> Presets
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Saved Filters</DropdownMenuLabel>
                  {savedFilters.length === 0 ? (
                    <div className="px-2 py-4 text-center text-xs text-muted-foreground italic">No presets saved</div>
                  ) : (
                    savedFilters.map((preset, idx) => (
                      <DropdownMenuItem key={idx} onClick={() => applyPreset(preset)}>
                        {preset.name}
                      </DropdownMenuItem>
                    ))
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => {
                    const name = prompt("Filter Name:");
                    if (name) saveCurrentFilter(name);
                  }}>
                    Save Current View...
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="flex items-center gap-1 bg-muted/40 p-0.5 rounded-lg border ml-auto">
                <Button variant={view === "list" ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={() => setView("list")} aria-label="List view"><ListIcon className="h-4 w-4" /></Button>
                <Button variant={view === "board" ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={() => setView("board")} aria-label="Board view"><LayoutGrid className="h-4 w-4" /></Button>
                <Button variant={tab === "calendar" ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={() => setTab("calendar")} aria-label="Calendar view"><Calendar className="h-4 w-4" /></Button>
              </div>

              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-muted-foreground hover:text-foreground">Reset</Button>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      {loading ? (
        <div className="grid place-items-center py-12" role="status" aria-label="Loading tasks">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
        </div>
      ) : tab === "calendar" ? (
        <Card className="p-4 sm:p-6 overflow-hidden">
          <div className="h-[700px] faith-calendar">
            <DnDCalendar
              localizer={localizer}
              events={filtered.map(t => ({
                id: t.id,
                title: t.title,
                start: t.start_date ? new Date(t.start_date) : (t.due_date ? new Date(t.due_date) : new Date()),
                end: t.due_date ? new Date(t.due_date) : (t.start_date ? new Date(t.start_date) : new Date()),
                resource: t,
              }))}
              startAccessor={(e: any) => new Date(e.start)}
              endAccessor={(e: any) => new Date(e.end)}

              defaultView={Views.MONTH}
              views={[Views.MONTH, Views.WEEK, Views.DAY]}
              onSelectEvent={(e: any) => setViewing(e.resource)}
              onEventDrop={async ({ event, start, end }: any) => {
                const task = event.resource as Task;
                try {
                  const updates: TaskInput = {
                    start_date: start instanceof Date ? start.toISOString() : new Date(start).toISOString(),
                    due_date: end instanceof Date ? end.toISOString() : new Date(end).toISOString()
                  };
                  await updateTask(task.id, updates);
                  await logTaskAction(task.id, "reschedule_dnd", { 
                    old: { start: task.start_date, due: task.due_date },
                    new: { start: updates.start_date, due: updates.due_date }
                  });
                  toast.success("Task rescheduled");
                  await load();
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
              resizable
              onEventResize={async ({ event, start, end }: any) => {
                const task = event.resource as Task;
                try {
                  const updates: TaskInput = {
                    start_date: start instanceof Date ? start.toISOString() : new Date(start).toISOString(),
                    due_date: end instanceof Date ? end.toISOString() : new Date(end).toISOString()
                  };
                  await updateTask(task.id, updates);
                  await logTaskAction(task.id, "resize_dnd", { 
                    old: { start: task.start_date, due: task.due_date },
                    new: { start: updates.start_date, due: updates.due_date }
                  });
                  toast.success("Task duration updated");
                  await load();
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
              draggableAccessor={() => true}
              eventPropGetter={(event: any) => ({
                className: cn(
                  "rounded-md border-l-4 px-2 py-0.5 text-xs font-medium shadow-sm transition-opacity hover:opacity-90",
                  TASK_PRIORITY_STYLE[event.resource.priority as TaskPriority].includes("red") ? "bg-red-500/10 text-red-700 border-red-500" :
                  TASK_PRIORITY_STYLE[event.resource.priority as TaskPriority].includes("orange") ? "bg-orange-500/10 text-orange-700 border-orange-500" :
                  TASK_PRIORITY_STYLE[event.resource.priority as TaskPriority].includes("amber") ? "bg-amber-500/10 text-amber-700 border-amber-500" :
                  "bg-primary/10 text-primary border-primary"
                ),
                style: { border: 'none' }
              })}
              components={{
                toolbar: (props) => (
                  <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg">
                      <Button variant="ghost" size="sm" onClick={() => props.onNavigate('PREV')}><ChevronLeft className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => props.onNavigate('TODAY')} className="text-xs font-bold uppercase tracking-wider">Today</Button>
                      <Button variant="ghost" size="sm" onClick={() => props.onNavigate('NEXT')}><ChevronRight className="h-4 w-4" /></Button>
                    </div>
                    <h2 className="text-lg font-bold tracking-tight">{props.label}</h2>
                    <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg">
                      {(['month', 'week', 'day'] as const).map((v) => (
                        <Button
                          key={v}
                          variant={props.view === v ? "secondary" : "ghost"}
                          size="sm"
                          onClick={() => props.onView(v)}
                          className={cn("text-xs capitalize", props.view === v && "shadow-sm")}
                        >
                          {v}
                        </Button>
                      ))}
                    </div>
                  </div>
                )
              }}
            />
          </div>
        </Card>


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
              users={users}
              onToggleDone={() => onQuickStatus(t, (t.status === "completed" || t.status === "done") ? "todo" : "completed")}
              onView={() => setViewing(t)}
              onEdit={() => openEdit(t)}
              onDelete={() => setConfirmDelete(t)}
              onStatusChange={(s) => onQuickStatus(t, s)}
              onAssign={(uid) => onQuickAssign(t, uid)}
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
                onView={setViewing}
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

      <TaskDetailsDialog
        open={!!viewing}
        onOpenChange={(open) => !open && setViewing(null)}
        task={viewing}
        users={users}
        onEdit={openEdit}
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
  task: t, assignee, users, onToggleDone, onView, onEdit, onDelete, onStatusChange, onAssign,
}: {
  task: Task;
  assignee: TaskAssignee | null;
  users: TaskAssignee[];
  onToggleDone: () => void;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (s: TaskStatus) => void;
  onAssign: (assigneeId: string | null) => void;
}) {
  const Icon = STATUS_ICON[t.status];
  const overdue = !!((t.due_date && t.status !== "done" && new Date(t.due_date) < new Date()) || t.status === "overdue");

  return (
    <Card 
      className={cn(
        "group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-primary/30 active:scale-[0.99] cursor-pointer bg-card/50 backdrop-blur-sm border-muted/40",
        t.status === "done" && "opacity-70 bg-muted/30"
      )} 
      role="listitem"
      onClick={onView}
    >
      <div className={cn("absolute left-0 top-0 bottom-0 w-1", TASK_PRIORITY_STYLE[t.priority].includes("red") ? "bg-red-500" : TASK_PRIORITY_STYLE[t.priority].includes("orange") ? "bg-orange-500" : "bg-primary/50")} />
      
      <CardContent 
        className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onView();
          }
        }}
        tabIndex={0}
        aria-label={`View details for task: ${t.title}`}
      >
        <button
          onClick={(e) => { e.stopPropagation(); onToggleDone(); }}
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-xl border-2 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            t.status === "done" ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 shadow-[0_0_15px_rgba(16,185,129,0.1)]" :
              t.status === "in_progress" ? "border-blue-500/50 bg-blue-500/10 text-blue-600" :
                t.status === "overdue" ? "border-rose-500/50 bg-rose-500/10 text-rose-600 animate-pulse" :
                  "border-border bg-muted/50 text-muted-foreground hover:border-primary/50 hover:bg-primary/5 hover:text-primary",
          )}
          aria-label={t.status === "completed" || t.status === "done" ? `Mark ${t.title} as to do` : `Mark ${t.title} as done`}
        >
          <Icon className={cn("h-5 w-5", (t.status === "completed" || t.status === "done") && "scale-110")} aria-hidden />
        </button>

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={cn("text-base font-bold tracking-tight transition-colors group-hover:text-primary", (t.status === "completed" || t.status === "done") && "line-through text-muted-foreground")}>{t.title}</h3>
            <div className="flex gap-1.5 flex-wrap">
              <Badge variant="secondary" className={cn("h-5 px-2 text-[10px] font-semibold uppercase tracking-wider border shadow-sm", TASK_STATUS_STYLE[t.status])}>
                {TASK_STATUS_LABELS[t.status]}
              </Badge>
              <Badge variant="outline" className={cn("h-5 px-2 text-[10px] font-semibold uppercase tracking-wider border shadow-sm", TASK_PRIORITY_STYLE[t.priority])}>
                {TASK_PRIORITY_LABELS[t.priority]}
              </Badge>
              {overdue && (
                <Badge variant="destructive" className="h-5 px-2 text-[10px] font-bold uppercase tracking-wider animate-bounce">
                  Overdue
                </Badge>
              )}
            </div>
          </div>
          
          {t.description && (
            <p className="line-clamp-1 text-sm text-muted-foreground/80 font-medium">{t.description}</p>
          )}
          
          <div className="flex flex-wrap gap-4 pt-1 items-center">
            {t.category && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full"><Tag className="h-3 w-3" aria-hidden />{TASK_CATEGORY_LABELS[t.category]}</span>
            )}
            {t.due_date && (
              <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full", overdue ? "text-rose-600 bg-rose-500/10" : "text-muted-foreground bg-muted/50")}><Calendar className="h-3 w-3" aria-hidden />{new Date(t.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
            )}
            <Select value={t.assignee_id ?? "none"} onValueChange={(v) => onAssign(v === "none" ? null : v)}>
              <SelectTrigger 
                className="h-6 w-auto min-w-[100px] border-primary/10 bg-primary/5 px-2 py-0 rounded-full text-[11px] font-bold text-primary hover:bg-primary/10" 
                onClick={(e) => e.stopPropagation()}
                aria-label={`Assign task ${t.title}`}
              >
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 rounded-full bg-primary/20 grid place-items-center">
                    <UserIcon className="h-2.5 w-2.5 text-primary" />
                  </div>
                  <SelectValue placeholder="Unassigned">
                    {assignee ? (assignee.full_name?.split(' ')[0] || assignee.email.split('@')[0]) : "Assign"}
                  </SelectValue>
                </div>
              </SelectTrigger>
              <SelectContent onClick={(e) => e.stopPropagation()}>
                <SelectItem value="none">Unassigned</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.full_name || u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-3 ml-auto">
               {t.checklists && t.checklists.length > 0 && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground/70">
                        <CheckSquare className="h-3.5 w-3.5" />
                        <span>{t.checklists.filter(c => c.is_completed).length}/{t.checklists.length}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>Subtasks progress</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {t.comments && t.comments.length > 0 && (
                <div className="flex items-center gap-1 text-xs font-bold text-muted-foreground/70"><MessageSquare className="h-3.5 w-3.5" />{t.comments.length}</div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 border-l pl-4 sm:ml-2" onClick={(e) => e.stopPropagation()}>
          <TooltipProvider>
            {t.status !== 'done' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-9 w-9 rounded-full hover:bg-emerald-500/10 hover:text-emerald-600 transition-colors" onClick={() => onStatusChange('done')} aria-label="Mark complete"><CheckCircle2 className="h-4 w-4" aria-hidden /></Button>
                </TooltipTrigger>
                <TooltipContent>Quick Complete</TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className="h-9 w-9 rounded-full hover:bg-primary/10 hover:text-primary transition-colors" onClick={onEdit} aria-label={`Edit task ${t.title}`}><Pencil className="h-4 w-4" aria-hidden /></Button>
              </TooltipTrigger>
              <TooltipContent>Edit Task</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className="h-9 w-9 rounded-full hover:bg-rose-500/10 hover:text-rose-600 transition-colors" onClick={onDelete} aria-label={`Delete task ${t.title}`}><Trash2 className="h-4 w-4" aria-hidden /></Button>
              </TooltipTrigger>
              <TooltipContent>Delete Task</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardContent>
    </Card>
  );
}

function BoardColumn({
  status, tasks, users, onEdit, onDelete, onStatusChange, onView,
}: {
  status: TaskStatus;
  tasks: Task[];
  users: Map<string, TaskAssignee>;
  onEdit: (t: Task) => void;
  onDelete: (t: Task) => void;
  onStatusChange: (t: Task, s: TaskStatus) => void;
  onView: (t: Task) => void;
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
              onView={() => onView(t)}
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
  task, assignee, onView, onEdit, onDelete, onStatusChange,
}: {
  task: Task;
  assignee: TaskAssignee | null;
  onView: () => void;
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
      <TaskCard task={task} assignee={assignee} onView={onView} onEdit={onEdit} onDelete={onDelete} onStatusChange={onStatusChange} />
    </div>
  );
}

function TaskCard({
  task: t, assignee, compact, onView, onEdit, onDelete, onStatusChange,
}: {
  task: Task;
  assignee: TaskAssignee | null;
  compact?: boolean;
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onStatusChange?: (s: TaskStatus) => void;
}) {
  const overdue = !!((t.due_date && t.status !== "completed" && t.status !== "done" && new Date(t.due_date) < new Date()) || t.status === "overdue");
  return (
    <div 
      className={cn("rounded-xl border bg-background p-3 shadow-sm transition hover:shadow-md cursor-pointer", compact && "shadow-lg")}
      onClick={onView}
    >
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
          onClick={(e) => e.stopPropagation()}
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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setErrors({});
      return;
    }
    setForm(editing ? {
      title: editing.title, description: editing.description,
      status: editing.status, priority: editing.priority, category: editing.category,
      due_date: editing.due_date, start_date: editing.start_date,
      reminder_date: editing.reminder_date, reminder_time: editing.reminder_time,
      assignee_id: editing.assignee_id,
    } : { status: "todo", priority: "normal", category: "internal", title: "" });
  }, [open, editing]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!form.title?.trim()) newErrors.title = "Task objective is required";
    if (!form.status) newErrors.status = "Status is required";
    if (!form.priority) newErrors.priority = "Priority is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      toast.error("Please fix the errors before submitting");
      return;
    }
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden border-none shadow-2xl">
        <div className="bg-gradient-to-br from-primary/10 via-background to-background p-6">
          <DialogHeader className="mb-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-fuchsia-500 grid place-items-center shadow-lg shadow-primary/20">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold tracking-tight">
                  {editing ? "Refine Task" : "Create New Task"}
                </DialogTitle>
                <p className="text-sm text-muted-foreground font-medium">
                  {editing ? "Update the details and objectives of this task." : "Define clear goals and assign team members."}
                </p>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={submit} className="space-y-6">
            <div className="grid gap-6">
              <div className="space-y-2">
                <Label htmlFor="title" className={cn("text-sm font-bold uppercase tracking-wider", errors.title ? "text-destructive" : "text-muted-foreground/70")}>
                  Task Objective <span className="text-destructive">*</span>
                </Label>
                <Input 
                  id="title" 
                  aria-invalid={!!errors.title}
                  aria-describedby={errors.title ? "title-error" : undefined}
                  autoFocus 
                  value={form.title ?? ""} 
                  onChange={(e) => {
                    setForm((f) => ({ ...f, title: e.target.value }));
                    if (errors.title) setErrors(prev => ({ ...prev, title: "" }));
                  }}
                  placeholder="e.g., Review Australia student visa documents"
                  className={cn(
                    "h-12 text-lg font-semibold bg-background/50 border-muted focus:border-primary/50 transition-all shadow-sm",
                    errors.title && "border-destructive focus:border-destructive"
                  )}
                />
                {errors.title && <p id="title-error" className="text-xs font-bold text-destructive animate-in fade-in slide-in-from-top-1">{errors.title}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="desc" className="text-sm font-bold uppercase tracking-wider text-muted-foreground/70">Strategic Context</Label>
                <Textarea 
                  id="desc" 
                  rows={3} 
                  value={form.description ?? ""} 
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Provide detailed instructions or background information..."
                  className="bg-background/50 border-muted focus:border-primary/50 resize-none font-medium"
                />
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="task-assignee" className="text-sm font-bold uppercase tracking-wider text-muted-foreground/70">Lead Assignee</Label>
                  <Select value={form.assignee_id ?? "none"} onValueChange={(v) => setForm((f) => ({ ...f, assignee_id: v === "none" ? null : v }))}>
                    <SelectTrigger id="task-assignee" className="h-11 bg-background/50 border-muted font-bold">
                      <div className="flex items-center gap-2">
                        <UserIcon className="h-4 w-4 text-primary/70" />
                        <SelectValue placeholder="Select lead..." />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="font-bold text-muted-foreground">Unassigned</SelectItem>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id} className="font-semibold">
                          {u.full_name || u.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="task-priority" className={cn("text-sm font-bold uppercase tracking-wider", errors.priority ? "text-destructive" : "text-muted-foreground/70")}>
                    Execution Priority <span className="text-destructive">*</span>
                  </Label>
                  <Select value={form.priority ?? "normal"} onValueChange={(v) => {
                    setForm((f) => ({ ...f, priority: v as TaskPriority }));
                    if (errors.priority) setErrors(prev => ({ ...prev, priority: "" }));
                  }}>
                    <SelectTrigger id="task-priority" className={cn("h-11 bg-background/50 border-muted font-bold", errors.priority && "border-destructive")}>
                      <div className="flex items-center gap-2">
                        <AlertOctagon className="h-4 w-4 text-primary/70" />
                        <SelectValue />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {TASK_PRIORITIES.map((p) => (
                        <SelectItem key={p} value={p} className="font-semibold">
                          {TASK_PRIORITY_LABELS[p]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.priority && <p className="text-xs font-bold text-destructive">{errors.priority}</p>}
                </div>
              </div>

              <div className="grid gap-6 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="task-status" className={cn("text-sm font-bold uppercase tracking-wider", errors.status ? "text-destructive" : "text-muted-foreground/70")}>
                    Current Status <span className="text-destructive">*</span>
                  </Label>
                  <Select value={form.status ?? "todo"} onValueChange={(v) => {
                    setForm((f) => ({ ...f, status: v as TaskStatus }));
                    if (errors.status) setErrors(prev => ({ ...prev, status: "" }));
                  }}>
                    <SelectTrigger id="task-status" className={cn("h-10 bg-background/50 border-muted font-bold", errors.status && "border-destructive")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TASK_STATUSES.map((s) => (
                        <SelectItem key={s} value={s} className="font-semibold">
                          {TASK_STATUS_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.status && <p className="text-xs font-bold text-destructive">{errors.status}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="task-category" className="text-sm font-bold uppercase tracking-wider text-muted-foreground/70">Operational Category</Label>
                  <Select value={form.category ?? "internal"} onValueChange={(v) => setForm((f) => ({ ...f, category: v as TaskCategory }))}>
                    <SelectTrigger id="task-category" className="h-10 bg-background/50 border-muted font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TASK_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c} className="font-semibold">
                          {TASK_CATEGORY_LABELS[c]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="due" className="text-sm font-bold uppercase tracking-wider text-muted-foreground/70">Target Deadline</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input 
                      id="due" 
                      type="date" 
                      value={form.due_date ?? ""} 
                      onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value || null }))}
                      className="h-10 pl-9 bg-background/50 border-muted font-bold focus:border-primary/50"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-primary/10 pt-6">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="font-bold text-muted-foreground hover:bg-muted/50 rounded-xl px-6">
                Discard
              </Button>
              <Button type="submit" disabled={saving} className="min-w-[160px] h-12 rounded-xl bg-gradient-to-r from-primary to-fuchsia-600 hover:shadow-lg hover:shadow-primary/25 transition-all font-bold text-base">
                {saving ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-5 w-5" />
                )}
                {editing ? "Update Task" : "Deploy Task"}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TaskDetailsDialog({
  task: t,
  open,
  onOpenChange,
  users,
  onEdit,
}: {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: TaskAssignee[];
  onEdit: (t: Task) => void;
}) {
  if (!t) return null;
  const assignee = t.assignee_id ? users.find((u) => u.id === t.assignee_id) : null;
  const overdue = !!((t.due_date && t.status !== "completed" && t.status !== "done" && new Date(t.due_date) < new Date()) || t.status === "overdue");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className={cn("border text-[10px]", TASK_PRIORITY_STYLE[t.priority])}>
              {TASK_PRIORITY_LABELS[t.priority]}
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              {TASK_CATEGORY_LABELS[t.category]}
            </Badge>
          </div>
          {t.dependencies && t.dependencies.length > 0 && (
            <div className="flex items-center gap-2 mb-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-md">
              <AlertOctagon className="h-4 w-4 text-amber-600" />
              <span className="text-xs font-medium text-amber-700"> Prerequisite task pending. Completion blocked.</span>
            </div>
          )}
          <DialogTitle className="text-xl font-bold flex items-center gap-2">

            {(t.status === "completed" || t.status === "done") && <CheckCircle2 className="h-5 w-5 text-green-500" />}
            {t.title}
          </DialogTitle>
          <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              <span>Status: {TASK_STATUS_LABELS[t.status]}</span>
            </div>
            {t.due_date && (
              <div className={cn("flex items-center gap-1.5", overdue && "text-rose-600 font-medium")}>
                <Calendar className="h-4 w-4" />
                <span>Due: {new Date(t.due_date).toLocaleDateString()}</span>
              </div>
            )}
            {assignee && (
              <div className="flex items-center gap-1.5">
                <UserIcon className="h-4 w-4" />
                <span>Assignee: {assignee.full_name || assignee.email}</span>
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {t.description && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <ListIcon className="h-4 w-4" /> Description
              </h4>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap rounded-lg bg-muted/50 p-3">
                {t.description}
              </p>
            </div>
          )}

          <div className="grid gap-6 sm:grid-cols-2">
            {t.checklists && t.checklists.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <CheckSquare className="h-4 w-4" /> Checklist
                </h4>
                <div className="space-y-2">
                  {t.checklists.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 text-sm">
                      <div className={cn(
                        "h-4 w-4 rounded border flex items-center justify-center",
                        item.is_completed ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground"
                      )}>
                        {item.is_completed && <CheckCircle2 className="h-3 w-3" />}
                      </div>
                      <span className={cn(item.is_completed && "line-through text-muted-foreground")}>
                        {item.title}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <History className="h-4 w-4" /> Timeline & Details
              </h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                {t.start_date && <div>Start Date: {new Date(t.start_date).toLocaleDateString()}</div>}
                {t.reminder_date && (
                  <div className="flex items-center gap-1.5">
                    <BellRing className="h-3.5 w-3.5" />
                    Reminder: {new Date(t.reminder_date).toLocaleDateString()} {t.reminder_time}
                  </div>
                )}
                {t.created_at && <div>Created: {new Date(t.created_at).toLocaleString()}</div>}
              </div>
            </div>
          </div>

          {(t.comments?.length || 0) > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Comments ({t.comments?.length})
              </h4>
              <div className="space-y-3 max-h-[200px] overflow-y-auto pr-2">
                {t.comments?.map((comment) => (
                  <div key={comment.id} className="text-sm bg-muted/30 p-2 rounded">
                    <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                      <span>{users.find(u => u.id === comment.user_id)?.full_name || "User"}</span>
                      <span>{new Date(comment.created_at).toLocaleString()}</span>
                    </div>
                    {comment.content}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="sm:justify-between items-center gap-4">
          <div className="text-xs text-muted-foreground italic">
            Task ID: {t.id.split('-')[0]}...
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { onOpenChange(false); onEdit(t); }}>
              <Pencil className="h-4 w-4 mr-2" /> Edit Task
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
