"use client";

import { useState, useEffect, useRef } from "react";
import { useApp } from "@/context/AppContext";
import { useStatuses } from "@/context/StatusContext";
import {
  getTask,
  updateTask,
  getMembers,
  getLabels,
  getSubtasks,
  createSubtask,
  updateSubtask,
  deleteSubtask,
  getActivity,
  createComment,
} from "@/lib/api";
import { formatDate, formatRelative, dueDateStatus } from "@/utils/date";
import type {
  Task,
  ProjectStatus,
  Activity,
  Subtask,
  WorkspaceMember,
  Label,
  User,
  Priority,
} from "@/types";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  Clock,
  Check,
  X,
  ChevronRight,
  MessageSquare,
  ListTodo,
  Trash2,
  Send,
  Plus,
} from "lucide-react";

const PRIORITY_CFG: Record<string, { label: string; dot: string }> = {
  low: { label: "Low", dot: "bg-emerald-500" },
  medium: { label: "Medium", dot: "bg-amber-400" },
  high: { label: "High", dot: "bg-red-500" },
};

interface SubtaskRowProps {
  subtask: Subtask;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

// ─── Subtask Row ─────────────────────────────────────────────────────────────
function SubtaskRow({ subtask, onToggle, onDelete }: SubtaskRowProps) {
  return (
    <div
      className="group flex items-center gap-2.5 px-2.5 py-2 rounded-md cursor-pointer
                 border border-transparent hover:bg-[#f8f8f6] hover:border-black/5
                 transition-colors"
      onClick={() => onToggle(subtask.id)}
    >
      <div
        className={`flex-shrink-0 w-4 h-4 rounded-[4px] border-[1.5px] flex items-center justify-center transition-all
          ${
            subtask.is_done
              ? "bg-violet-600 border-violet-600"
              : "bg-white border-zinc-300 hover:border-violet-400"
          }`}
      >
        {subtask.is_done && (
          <Check size={9} strokeWidth={3} className="text-white" />
        )}
      </div>

      <span
        className={`flex-1 text-[13.5px] transition-colors
        ${subtask.is_done ? "line-through text-zinc-400 decoration-zinc-300" : "text-zinc-700"}`}
      >
        {subtask.title}
      </span>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(subtask.id);
        }}
        className="opacity-0 group-hover:opacity-100 p-1 rounded text-zinc-300
                   hover:text-red-500 hover:bg-red-50 transition-all focus:opacity-100"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}

interface ActivityItemProps {
  item: Activity;
}

// ─── Activity Item ────────────────────────────────────────────────────────────
function ActivityItem({ item }: ActivityItemProps) {
  const isComment = item.type === "comment";
  return (
    <div className="flex gap-3">
      <Avatar className="h-7 w-7 shrink-0 ring-2 ring-white">
        <AvatarImage src={item.user_avatar ?? undefined} />
        <AvatarFallback className="text-[9px] font-bold uppercase bg-violet-100 text-violet-700">
          {item.user_name?.[0] || "?"}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5 mb-1">
          <span className="text-[12px] font-semibold text-zinc-900">
            {item.user_name || "System"}
          </span>
          <span className="text-[11px] text-zinc-400">
            {formatRelative(item.created_at)}
          </span>
        </div>

        {isComment ? (
          <p
            className="text-[13px] leading-relaxed text-zinc-800 bg-zinc-50 border border-black/5
                        rounded-[0_10px_10px_10px] px-3.5 py-2.5"
          >
            {item.content}
          </p>
        ) : (
          <p className="text-[12px] italic text-zinc-400">
            {item.content}
            {item.before_value && (
              <span className="not-italic font-semibold text-zinc-500 mx-1">
                {item.before_value} → {item.after_value}
              </span>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

interface SectionLabelProps {
  icon: React.ReactNode;
  label: string;
}

// ─── Section Label ────────────────────────────────────────────────────────────
function SectionLabel({ icon, label }: SectionLabelProps) {
  return (
    <div
      className="flex items-center gap-1.5 text-[9px] font-bold tracking-[0.12em] uppercase
                    text-zinc-400 mb-2.5"
    >
      <span className="opacity-60">{icon}</span>
      {label}
    </div>
  );
}

interface PropItemProps {
  label: string;
  children: React.ReactNode;
}

// ─── Prop Item ────────────────────────────────────────────────────────────────
function PropItem({ label, children }: PropItemProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-bold tracking-[0.08em] uppercase text-zinc-400">
        {label}
      </span>
      {children}
    </div>
  );
}

interface MetaRowProps {
  label: string;
  value: string | null | undefined;
  muted?: boolean;
}

// ─── Meta Row ─────────────────────────────────────────────────────────────────
function MetaRow({ label, value, muted = false }: MetaRowProps) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] font-bold tracking-[0.08em] uppercase text-zinc-300">
        {label}
      </span>
      <span
        className={`text-[10px] font-mono font-medium truncate max-w-[130px]
                        ${muted ? "text-zinc-400" : "text-zinc-500"}`}
      >
        {value || "—"}
      </span>
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────
export default function TaskDetailModal() {
  const { activeWorkspace, activeProject, activeTaskId, closeTask } = useApp();
  const { statuses } = useStatuses();

  const [task, setTask] = useState<Task | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [labels, setLabels] = useState<string[]>([]);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [newSubtask, setNewSubtask] = useState<string>("");
  const [newComment, setNewComment] = useState<string>("");
  const [saveState, setSaveState] = useState<"" | "saving" | "saved">("");

  const descTimerRef = useRef<NodeJS.Timeout | null>(null);
  const commentRef = useRef<HTMLTextAreaElement | null>(null);

  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewComment(e.target.value);
    const el = commentRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
    }
  };

  // ── Load task data ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeTaskId || !activeWorkspace) {
      setTask(null);
      setSubtasks([]);
      setActivities([]);
      setTitle("");
      setDescription("");
      return;
    }

    let alive = true;

    (async () => {
      setLoading(true);
      try {
        const [tRes, sRes, aRes] = await Promise.all([
          getTask(activeWorkspace.id, activeTaskId),
          getSubtasks(activeWorkspace.id, activeTaskId),
          getActivity(activeWorkspace.id, activeTaskId),
        ]);
        if (!alive) return;
        if (tRes.data) {
          setTask(tRes.data);
          setTitle(tRes.data.title || "");
          setDescription(tRes.data.description || "");
        }
        setSubtasks(sRes.data || []);
        setActivities(aRes.data || []);
      } catch (err) {
        console.error("Failed to load task", err);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    (async () => {
      try {
        if (!members.length) {
          const res = await getMembers(activeWorkspace.id);
          setMembers(res.data || []);
        }
        if (!labels.length) {
          const res = await getLabels(activeWorkspace.id);
          setLabels(res.data || []);
        }
      } catch (err) {
        console.error("Failed to load metadata", err);
      }
    })();

    return () => {
      alive = false;
    };
  }, [activeTaskId, activeWorkspace]);

  // ── Patch helper ──────────────────────────────────────────────────────────
  const patchTask = async (data: Partial<Task>) => {
    if (!task || !activeWorkspace) return;
    setSaveState("saving");
    try {
      const res = await updateTask(activeWorkspace.id, task.id, data);
      setTask(res.data);
      setSaveState("saved");
      setTimeout(() => setSaveState(""), 2000);
      getActivity(activeWorkspace.id, task.id).then((a) =>
        setActivities(a.data || []),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error("Failed to patch task", message);
      setSaveState("");
    }
  };

  // ── Title ─────────────────────────────────────────────────────────────────
  const handleTitleBlur = () => {
    const t = title.trim();
    if (!t) {
      setTitle(task?.title || "");
      return;
    }
    if (t !== task?.title) patchTask({ title: t });
  };

  // ── Description (debounced) ───────────────────────────────────────────────
  const handleDescChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setDescription(val);
    if (descTimerRef.current) clearTimeout(descTimerRef.current);
    descTimerRef.current = setTimeout(() => {
      if (val.trim() !== (task?.description || "").trim())
        patchTask({ description: val.trim() });
    }, 800);
  };

  // ── Subtasks ──────────────────────────────────────────────────────────────
  const handleAddSubtask = async () => {
    if (!newSubtask.trim() || !activeWorkspace || !task) return;
    try {
      const res = await createSubtask(activeWorkspace.id, task.id, {
        title: newSubtask.trim(),
      });
      setSubtasks((prev) =>
        [...prev, res.data].sort((a, b) => a.position - b.position),
      );
      setNewSubtask("");
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleSubtask = async (subtaskId: string) => {
    if (!activeWorkspace) return;
    const s = subtasks.find((x) => x.id === subtaskId);
    if (!s || !task) return;

    if (s.task_id !== task.id) {
      console.error("Mismatch task_id!", {
        subtask_task_id: s.task_id,
        current_task_id: task.id,
      });
      return;
    }

    try {
      const res = await updateSubtask(activeWorkspace.id, task.id, s.id, {
        is_done: !s.is_done,
      });

      setSubtasks((prev) => prev.map((x) => (x.id === s.id ? res.data : x)));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteSubtask = async (subtaskId: string) => {
    if (!task || !activeWorkspace) return;
    try {
      await deleteSubtask(activeWorkspace.id, task.id, subtaskId);
      setSubtasks((prev) => prev.filter((s) => s.id !== subtaskId));
    } catch (err) {
      console.error(err);
    }
  };

  // ── Comment ───────────────────────────────────────────────────────────────
  const handleAddComment = async () => {
    if (!newComment.trim() || !activeWorkspace || !task) return;
    try {
      const res = await createComment(
        activeWorkspace.id,
        task.id,
        newComment.trim(),
      );
      setActivities((prev) => [res.data, ...prev]);
      setNewComment("");
    } catch (err) {
      console.error(err);
    }
  };

  if (!activeTaskId) return null;

  const completedCount = subtasks.filter((s) => s.is_done).length;
  const progress =
    subtasks.length > 0 ? (completedCount / subtasks.length) * 100 : 0;
  const isOverdue = dueDateStatus(task?.due_date) === "overdue";

  return (
    <Dialog open={!!activeTaskId} onOpenChange={(open) => !open && closeTask()}>
      <DialogContent
        className="max-w-5xl sm:max-w-4xl md:max-w-5xl lg:max-w-[1000px] w-full p-0 gap-0 overflow-hidden bg-white border-black/[0.08]
                                h-[86vh] flex flex-col shadow-2xl rounded-2xl [&>button]:hidden"
      >
        <DialogTitle className="sr-only">Task Details</DialogTitle>
        {/* ── HEADER ── */}
        <div
          className="h-[52px] flex items-center justify-between px-5
                        border-b border-black/[0.06] shrink-0 bg-white"
        >
          <div className="flex items-center gap-2.5">
            {/* Breadcrumb */}
            <div className="flex items-center gap-1 text-[11px] font-medium text-zinc-400 tracking-wide">
              <span className="hover:text-violet-600 cursor-pointer transition-colors">
                {activeWorkspace?.name}
              </span>
              <ChevronRight size={10} className="text-zinc-300" />
              <span className="text-zinc-600 font-semibold">
                {activeProject?.name || "Project"}
              </span>
            </div>

            <div className="w-px h-3.5 bg-zinc-200" />

            {/* Status pill */}
            <div
              className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full
                         text-[10px] font-bold tracking-widest uppercase border shrink-0"
              style={{
                background: `${task?.status?.color}12`,
                color: task?.status?.color,
                borderColor: `${task?.status?.color}28`,
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: task?.status?.color }}
              />
              {task?.status?.name}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Save indicator */}
            <div className="flex items-center gap-1.5 mr-3 min-w-[60px]">
              {saveState === "saving" && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              )}
              {saveState === "saved" && (
                <Check size={12} className="text-emerald-500" />
              )}
              <span className="text-[10px] text-zinc-400 font-medium">
                {saveState === "saving"
                  ? "Saving..."
                  : saveState === "saved"
                    ? "Saved"
                    : ""}
              </span>
            </div>

            <button
              className="w-[30px] h-[30px] flex items-center justify-center rounded-md
                               text-zinc-400 hover:bg-red-50 hover:text-red-500 transition-colors"
            >
              <Trash2 size={14} />
            </button>

            <div className="w-px h-4 bg-zinc-200 mx-0.5" />

            <button
              onClick={closeTask}
              className="w-[30px] h-[30px] flex items-center justify-center rounded-md
                         text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── BODY ── */}
        {loading ? (
          <div className="flex-1 flex overflow-hidden animate-pulse">
            {/* Left panel skeleton */}
            <div className="flex-1 px-12 py-10">
              <div className="h-8 w-2/3 bg-zinc-100 rounded-lg mb-7" />
              <div className="h-4 w-full bg-zinc-100 rounded mb-2" />
              <div className="h-4 w-4/5 bg-zinc-100 rounded mb-2" />
              <div className="h-4 w-3/5 bg-zinc-100 rounded" />
            </div>
            {/* Right panel skeleton */}
            <div className="w-[272px] bg-[#f9f9f7] border-l border-black/[0.06] px-5 py-7 space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="h-2.5 w-16 bg-zinc-200 rounded" />
                  <div className="h-8 w-full bg-zinc-200 rounded-lg" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex overflow-hidden">
            {/* ── LEFT PANEL ── */}
            <div
              className="flex-1 overflow-y-auto px-12 py-10
                          scrollbar-thin scrollbar-thumb-zinc-200 scrollbar-track-transparent"
            >
              <div className="max-w-2xl">
                {/* Title */}
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={handleTitleBlur}
                  onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                  placeholder="Task title"
                  className="w-full text-[27px] font-semibold text-zinc-900 tracking-tight
                           border-none outline-none bg-transparent mb-7
                           placeholder:text-zinc-200 leading-snug
                           !bg-transparent focus:!bg-transparent
                           autofill:!bg-transparent [-webkit-autofill]:!bg-transparent"
                />

                {/* Description */}
                <SectionLabel
                  icon={<MessageSquare size={11} />}
                  label="Description"
                />
                <textarea
                  value={description}
                  onChange={handleDescChange}
                  placeholder="Add a detailed description…"
                  className="w-full resize-none text-[14px] leading-relaxed text-zinc-600
                           border-none outline-none !bg-transparent focus:!bg-transparent
                           min-h-[80px] mb-9 placeholder:text-zinc-300"
                />

                {/* ── SUBTASKS ── */}
                <div className="mb-10">
                  <div className="flex items-center justify-between mb-3.5">
                    <SectionLabel
                      icon={<ListTodo size={11} />}
                      label="Subtasks"
                    />

                    {subtasks.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-zinc-400">
                          {completedCount}/{subtasks.length}
                        </span>
                        <div className="w-24 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-violet-600 rounded-full transition-all duration-500"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-0.5 mb-3">
                    {subtasks.map((s) => (
                      <SubtaskRow
                        key={s.id}
                        subtask={s}
                        onToggle={handleToggleSubtask}
                        onDelete={handleDeleteSubtask}
                      />
                    ))}
                  </div>

                  {subtasks.length === 0 && (
                    <div className="py-4 px-2.5 mb-2 text-[12px] text-zinc-300 italic">
                      No subtasks yet — add one below
                    </div>
                  )}
                  {/* Add subtask */}
                  <div className="flex items-center gap-2.5 px-2.5 group/add mt-4 shadow-sm">
                    <Plus
                      size={12}
                      className="text-zinc-300 group-hover/add:text-violet-500 transition-colors"
                    />
                    <input
                      value={newSubtask}
                      onChange={(e) => setNewSubtask(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddSubtask()}
                      placeholder="Add a subtask..."
                      className="flex-1 text-[13.5px] border-none outline-none
                               !bg-transparent focus:!bg-transparent
                               text-zinc-700 placeholder:text-zinc-300"
                    />
                    {newSubtask.trim() && (
                      <button
                        onClick={handleAddSubtask}
                        className="h-7 px-3 bg-white hover:bg-zinc-200 text-zinc-900
                                 text-[12px] font-bold rounded-md transition-colors"
                      >
                        Add
                      </button>
                    )}
                  </div>
                </div>

                {/* ── ACTIVITY ── */}
                <div className="pt-8 border-t border-zinc-100">
                  <SectionLabel
                    icon={<Clock size={11} />}
                    label="Activity & Comments"
                  />

                  <div className="space-y-6 mt-6 mb-8">
                    {activities.length === 0 ? (
                      <div
                        className="text-center py-8 rounded-xl bg-zinc-50
                                    border border-dashed border-zinc-200"
                      >
                        <p className="text-[12px] text-zinc-400">
                          No activity yet
                        </p>
                      </div>
                    ) : (
                      activities.map((a) => (
                        <ActivityItem key={a.id} item={a} />
                      ))
                    )}
                  </div>

                  {/* Comment composer */}
                  <div className="flex gap-3 items-end">
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarFallback className="text-[9px] font-bold bg-violet-600 text-white uppercase">
                        ME
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 relative">
                      <textarea
                        ref={commentRef}
                        value={newComment}
                        onChange={handleCommentChange}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (e.metaKey || e.ctrlKey))
                            handleAddComment();
                        }}
                        placeholder="Write a comment…"
                        rows={1}
                        className="w-full min-h-[42px] max-h-[140px] resize-none text-[13.5px]
                                 leading-relaxed text-zinc-800 bg-white border border-zinc-200
                                 focus:border-violet-300 focus:ring-2 focus:ring-violet-100
                                 rounded-xl px-3.5 py-2.5 pr-10 outline-none transition-all
                                 placeholder:text-zinc-300 overflow-hidden"
                      />
                      <button
                        onClick={handleAddComment}
                        disabled={!newComment.trim()}
                        className="absolute right-2.5 bottom-2.5 p-1.5 text-zinc-300
                                 hover:text-violet-600 disabled:pointer-events-none transition-colors"
                      >
                        <Send size={13} />
                      </button>
                      <p className="mt-1.5 text-[10px] text-zinc-400">
                        <span className="text-violet-500 font-semibold">
                          Cmd+Enter
                        </span>{" "}
                        to post
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── RIGHT PANEL ── */}
            <div
              className="w-[272px] shrink-0 bg-[#f9f9f7] border-l border-black/[0.06]
                          overflow-y-auto px-5 py-7
                          scrollbar-thin scrollbar-thumb-zinc-200 scrollbar-track-transparent"
            >
              <p className="text-[9px] font-bold tracking-[0.16em] uppercase text-zinc-400 mb-5">
                Properties
              </p>

              <div className="space-y-5">
                {/* Status */}
                <PropItem label="Status">
                  <Select
                    value={task?.status_id || ""}
                    onValueChange={(v) => patchTask({ status_id: v })}
                  >
                    <SelectTrigger
                      className="h-8 text-[12.5px] font-medium bg-white border-black/10
                                            hover:border-violet-300 rounded-lg shadow-none transition-colors"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ background: task?.status?.color }}
                        />
                        <span className="truncate">{task?.status?.name}</span>
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {statuses.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          <div className="flex items-center gap-2">
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ background: s.color }}
                            />
                            {s.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </PropItem>

                {/* Priority */}
                <PropItem label="Priority">
                  <Select
                    value={task?.priority || ""}
                    onValueChange={(v) => patchTask({ priority: v as Priority })}
                  >
                    <SelectTrigger
                      className="h-8 text-[12.5px] font-medium bg-white border-black/10
                                            hover:border-violet-300 rounded-lg shadow-none transition-colors"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0
                                        ${task?.priority && PRIORITY_CFG[task.priority] ? PRIORITY_CFG[task.priority].dot : "bg-zinc-300"}`}
                        />
                        <span className="uppercase tracking-wide text-[11px] font-bold">
                          {task?.priority || "None"}
                        </span>
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PRIORITY_CFG).map(([val, cfg]) => (
                        <SelectItem key={val} value={val}>
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}
                            />
                            {cfg.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </PropItem>

                {/* Assignee */}
                <PropItem label="Assignee">
                  <Popover>
                    <PopoverTrigger
                      className="flex h-8 w-full items-center justify-between px-3
                                             text-[12.5px] font-medium bg-white border border-black/10
                                             rounded-lg hover:border-violet-300 transition-colors group"
                    >
                      {task?.assignee ? (
                        <div className="flex items-center gap-2 truncate">
                          <Avatar className="h-4 w-4 shrink-0">
                            <AvatarImage src={task.assignee.avatar_url ?? undefined} />
                            <AvatarFallback className="text-[8px] uppercase font-bold bg-violet-100 text-violet-700">
                              {task.assignee.name?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate">
                            {task.assignee.name || task.assignee.email}
                          </span>
                        </div>
                      ) : (
                        <span className="text-zinc-400 font-normal italic text-[12px]">
                          No assignee
                        </span>
                      )}
                      <ChevronRight
                        size={12}
                        className="text-zinc-300 group-hover:text-violet-400
                                                       transition-colors shrink-0"
                      />
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-0" align="start">
                      <Command>
                        <CommandInput
                          placeholder="Search team…"
                          className="h-8 text-xs"
                        />
                        <CommandList>
                          <CommandEmpty>No one found</CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                              onSelect={() =>
                                patchTask({ assignee_id: "unassign" })
                              }
                              className="text-xs py-2 cursor-pointer text-zinc-500"
                            >
                              <X size={11} className="mr-2" /> Unassign
                            </CommandItem>
                            {members.map((m) => (
                              <CommandItem
                                key={m.id}
                                onSelect={() =>
                                  patchTask({ assignee_id: m.id })
                                }
                                className="text-xs py-2 cursor-pointer"
                              >
                                <Avatar className="h-5 w-5 mr-2.5">
                                  <AvatarImage src={m.avatar_url ?? undefined} />
                                  <AvatarFallback className="text-[9px] uppercase font-bold bg-violet-100 text-violet-700">
                                    {m.name?.[0]}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col truncate">
                                  <span className="font-semibold text-zinc-900 truncate">
                                    {m.name}
                                  </span>
                                  <span className="text-[10px] text-zinc-400 truncate">
                                    {m.email}
                                  </span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </PropItem>

                {/* Due Date */}
                <PropItem label="Due Date">
                  <Popover>
                    <PopoverTrigger
                      className={`flex h-8 w-full items-center justify-between px-3 text-[12.5px]
                                font-medium border rounded-lg transition-colors
                                ${
                                  isOverdue
                                    ? "bg-red-50 border-red-200 text-red-600"
                                    : "bg-white border-black/10 text-zinc-700 hover:border-violet-300"
                                }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        {isOverdue ? (
                          <AlertTriangle size={12} className="shrink-0" />
                        ) : (
                          <CalendarIcon
                            size={12}
                            className="text-zinc-400 shrink-0"
                          />
                        )}
                        <span className="truncate">
                          {task?.due_date ? (
                            <>
                              {formatDate(task.due_date)}
                              {isOverdue && (
                                <span className="ml-1 font-bold">
                                  · Overdue
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="italic font-normal text-zinc-400">
                              Set date…
                            </span>
                          )}
                        </span>
                      </div>
                      <ChevronRight
                        size={12}
                        className="text-zinc-300 shrink-0"
                      />
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={
                          task?.due_date ? new Date(task.due_date) : undefined
                        }
                        onSelect={(d) => {
                          const fmt = d
                            ? new Date(
                                d.getTime() - d.getTimezoneOffset() * 60000,
                              )
                                .toISOString()
                                .split("T")[0]
                            : null;
                          patchTask({ due_date: fmt });
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                </PropItem>

                {/* Label */}
                <PropItem label="Label">
                  <Popover>
                    <PopoverTrigger
                      className="flex h-8 w-full items-center justify-between px-3
                                             text-[12.5px] font-medium bg-white border border-black/10
                                             rounded-lg hover:border-violet-300 transition-colors group"
                    >
                      {task?.label ? (
                        <span
                          className="bg-violet-50 text-violet-700 border border-violet-100 rounded
                                       px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase"
                        >
                          {task.label}
                        </span>
                      ) : (
                        <span className="text-zinc-400 font-normal italic text-[12px]">
                          No label
                        </span>
                      )}
                      <Plus
                        size={12}
                        className="text-zinc-300 group-hover:text-violet-400
                                               transition-colors shrink-0"
                      />
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-0" align="start">
                      <Command>
                        <CommandInput
                          placeholder="Search or add label…"
                          className="h-8 text-xs"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && (e.target as HTMLInputElement).value) {
                              patchTask({ label: (e.target as HTMLInputElement).value });
                              document.dispatchEvent(
                                new KeyboardEvent("keydown", { key: "Escape" }),
                              );
                            }
                          }}
                        />
                        <CommandList>
                          <CommandEmpty className="text-[11px] p-3 text-zinc-400">
                            Press Enter to create label
                          </CommandEmpty>
                          <CommandGroup>
                            {task?.label && (
                              <CommandItem
                                onSelect={() => patchTask({ label: null })}
                                className="text-xs py-2 text-red-500 cursor-pointer"
                              >
                                <X size={11} className="mr-2" /> Remove Label
                              </CommandItem>
                            )}
                            {labels.map((l) => (
                              <CommandItem
                                key={l}
                                onSelect={() => patchTask({ label: l })}
                                className="text-xs py-2 cursor-pointer font-medium"
                              >
                                {l}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </PropItem>
              </div>

              {/* Meta */}
              <div className="mt-8 pt-6 border-t border-black/[0.06] space-y-2.5">
                <MetaRow
                  label="Created"
                  value={task?.created_at ? formatDate(task.created_at) : "—"}
                />
                <MetaRow
                  label="Updated"
                  value={
                    task?.updated_at ? formatRelative(task.updated_at) : "—"
                  }
                />
                <MetaRow label="Project ID" value={task?.project_id} muted />
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
