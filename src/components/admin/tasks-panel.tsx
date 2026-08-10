"use client";

import { useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DownloadIcon, PaperclipIcon, PlusIcon, Trash2Icon } from "lucide-react";
import {
  createTask,
  deleteTask,
  updateTask,
  addComment,
  deleteAttachment,
} from "@/actions/cue";
import {
  MentionTextarea,
  CommentBody,
} from "@/components/cue/mention-textarea";
import { StatusSelect } from "@/components/cue/status-select";
import { PersonAvatar } from "@/components/person-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  decorateTask,
  fileExt,
  formatBytes,
  formatDue,
  formatWhen,
  groupTasks,
  isImageMime,
  sortTasks,
  type DecoratedTask,
} from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Attachment, Comment, Person, Task, TaskStatus } from "@/lib/types";
import { statusClasses, TASK_STATUSES } from "@/lib/types";

const DESKTOP_ROW =
  "md:grid md:grid-cols-[minmax(0,1.4fr)_minmax(7rem,9rem)_minmax(6.5rem,7.5rem)_5.75rem] md:items-center md:gap-3";

function GlassAdminRow({
  task,
  late,
  onClick,
  last,
  selected,
}: {
  task: DecoratedTask;
  late?: boolean;
  onClick: () => void;
  last?: boolean;
  selected?: boolean;
}) {
  const done = task.status === "Done";
  const tone = statusClasses(task.status);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 px-3.5 py-3.5 text-left transition-colors md:px-4",
        DESKTOP_ROW,
        late
          ? "border-late/25 hover:bg-late/[0.08]"
          : "border-ink/10 hover:bg-white/45 dark:hover:bg-white/[0.06]",
        selected &&
          (late
            ? "bg-late/[0.12]"
            : "bg-white/55 dark:bg-white/[0.1]"),
        !last && "border-b-[0.5px]"
      )}
    >
      <div className="min-w-0">
        <div
          className={cn(
            "truncate text-[15px] font-medium tracking-[-0.01em] text-ink md:text-[15px]",
            done && "text-ink-2 line-through"
          )}
        >
          {task.title}
        </div>
        <div
          className={cn(
            "mt-1 flex flex-wrap items-center gap-1.5 text-[12.5px] md:hidden",
            late ? "text-late" : "text-ink-2"
          )}
        >
          <span className="truncate">
            {task.assignee?.name ?? "Unassigned"}
          </span>
          <span
            className={cn(
              "inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 font-mono text-[10.5px] font-medium leading-none",
              tone.trigger
            )}
          >
            {task.status}
          </span>
        </div>
      </div>

      <div className="hidden min-w-0 items-center gap-2 md:flex">
        <PersonAvatar
          person={task.assignee ?? { name: "?" }}
          size={22}
          className={late ? "ring-1 ring-late/40" : undefined}
        />
        <span
          className={cn(
            "truncate text-[13px]",
            late ? "text-late" : "text-ink-2"
          )}
        >
          {task.assignee?.name ?? "—"}
        </span>
      </div>

      <div className="hidden md:block">
        <span
          className={cn(
            "inline-flex max-w-full items-center truncate rounded-md border px-1.5 py-0.5 font-mono text-[11px] font-medium leading-none",
            tone.trigger
          )}
        >
          {task.status}
        </span>
      </div>

      <div
        className={cn(
          "shrink-0 font-mono text-[12.5px] tabular-nums md:text-right md:text-[13px]",
          late ? "font-medium text-late" : "text-ink-2"
        )}
      >
        {task.shortDateLabel}
      </div>
    </button>
  );
}

function TaskDetailEditor({
  task,
  people,
  comments,
  files,
  editTitle,
  setEditTitle,
  editDesc,
  setEditDesc,
  editAssignee,
  setEditAssignee,
  editDue,
  setEditDue,
  commentDraft,
  setCommentDraft,
  pending,
  onSave,
  onStatus,
  onDelete,
  onComment,
  onAttach,
  onRemoveFile,
}: {
  task: DecoratedTask;
  people: Person[];
  comments: Comment[];
  files: Attachment[];
  editTitle: string;
  setEditTitle: (v: string) => void;
  editDesc: string;
  setEditDesc: (v: string) => void;
  editAssignee: string;
  setEditAssignee: (v: string) => void;
  editDue: string;
  setEditDue: (v: string) => void;
  commentDraft: string;
  setCommentDraft: (v: string) => void;
  pending: boolean;
  onSave: () => void;
  onStatus: (s: TaskStatus) => void;
  onDelete: () => void;
  onComment: () => void;
  onAttach: (files: FileList | null) => void;
  onRemoveFile: (id: string) => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      {task.late && (
        <div className="rounded-[12px] bg-late/15 px-3.5 py-2 text-[13px] font-medium text-late">
          {task.dateLabel} · due {formatDue(task.due_date)}
        </div>
      )}

      <div className="glass-panel space-y-4 overflow-hidden p-4 md:p-5">
        <FieldGroup>
          <Field>
            <FieldLabel>Title</FieldLabel>
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="glass-surface"
            />
          </Field>
          <Field>
            <FieldLabel>Description</FieldLabel>
            <Textarea
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              rows={3}
              className="glass-surface min-h-[5rem] resize-y"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel>Assignee</FieldLabel>
              <Select
                value={editAssignee || "unassigned"}
                onValueChange={(v) =>
                  setEditAssignee(v === "unassigned" ? "" : v)
                }
              >
                <SelectTrigger className="glass-surface w-full">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {people.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Due date</FieldLabel>
              <Input
                type="date"
                value={editDue}
                onChange={(e) => setEditDue(e.target.value)}
                className="glass-surface font-mono"
              />
            </Field>
          </div>
        </FieldGroup>

        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-[13px] text-ink-2">Status</span>
          <StatusSelect
            value={task.status}
            onValueChange={onStatus}
            disabled={pending}
          />
        </div>

        <div className="flex flex-wrap gap-2 border-t-[0.5px] border-ink/10 pt-4">
          <Button
            type="button"
            className="rounded-[12px]"
            disabled={pending}
            onClick={onSave}
          >
            Save changes
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-[12px] text-late"
            disabled={pending}
            onClick={onDelete}
          >
            <Trash2Icon data-icon="inline-start" />
            Delete
          </Button>
        </div>
      </div>

      <div className="glass-panel overflow-hidden">
        <div className="flex items-baseline justify-between px-4 pt-3.5 pb-2">
          <span className="text-[13px] text-ink-2">Files</span>
          <span className="font-mono text-xs text-ink-2">
            {files.length || "none yet"}
          </span>
        </div>
        {files.map((f, i) => (
          <div
            key={f.id}
            className={cn(
              "flex items-center gap-3 px-4 py-2.5",
              i < files.length - 1 && "border-b-[0.5px] border-ink/10"
            )}
          >
            <div className="grid size-9 place-items-center rounded-[8px] bg-ink/5 font-mono text-[9px] text-ink-2">
              {isImageMime(f.mime_type, f.name) ? "IMG" : fileExt(f.name)}
            </div>
            <div className="min-w-0 flex-1 truncate text-sm">
              {f.name}
              <div className="font-mono text-xs text-ink-2">
                {formatBytes(f.size_bytes)}
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Download"
              onClick={async () => {
                const supabase = createClient();
                const { data, error } = await supabase.storage
                  .from("task-files")
                  .createSignedUrl(f.storage_path, 60);
                if (error || !data?.signedUrl) {
                  toast.error(error?.message || "Could not download file");
                  return;
                }
                window.open(data.signedUrl, "_blank");
              }}
            >
              <DownloadIcon />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Remove file"
              disabled={pending}
              className="text-ink-2 hover:text-late"
              onClick={() => onRemoveFile(f.id)}
            >
              <Trash2Icon />
            </Button>
          </div>
        ))}
        {files.length === 0 ? (
          <p className="px-4 pb-1 text-[13px] text-ink-2">No files yet.</p>
        ) : null}
        <div className="p-4 pt-2">
          <label className="glass-cta flex h-11 cursor-pointer items-center justify-center gap-2 rounded-[14px] text-sm font-medium">
            <PaperclipIcon className="size-4" />
            Attach file
            <input
              type="file"
              className="hidden"
              onChange={(e) => {
                onAttach(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </div>

      <div className="glass-panel overflow-hidden px-4 pt-4 pb-5">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-[13px] text-ink-2">Comments</span>
          <span className="font-mono text-xs text-ink-2">
            {comments.length || "none yet"}
          </span>
        </div>
        {comments.map((c) => (
          <div
            key={c.id}
            className="flex gap-2 border-b-[0.5px] border-ink/10 py-3 last:border-0"
          >
            <PersonAvatar
              person={c.author ?? { name: "?" }}
              size={28}
            />
            <div>
              <div className="flex gap-2 text-[13px]">
                <span className="font-medium">{c.author?.name}</span>
                <span className="font-mono text-[11px] text-ink-2">
                  {formatWhen(c.created_at)}
                </span>
              </div>
              <p className="mt-1 text-sm">
                <CommentBody text={c.body} />
              </p>
            </div>
          </div>
        ))}
        <MentionTextarea
          className="mt-3 glass-surface border-white/80 dark:border-white/10"
          rows={2}
          people={people}
          value={commentDraft}
          onChange={setCommentDraft}
          placeholder="Type @ to mention someone"
        />
        <Button
          type="button"
          className="mt-2 h-11 rounded-[14px]"
          disabled={pending}
          onClick={onComment}
        >
          Post comment
        </Button>
      </div>
    </div>
  );
}

export function AdminTasksPanel({
  people,
  tasks,
  commentsByTask,
  attachmentsByTask,
  adminId,
}: {
  people: Person[];
  tasks: Task[];
  commentsByTask: Record<string, Comment[]>;
  attachmentsByTask: Record<string, Attachment[]>;
  adminId: string;
}) {
  const router = useRouter();
  const [fAssignee, setFAssignee] = useState("all");
  const [fStatus, setFStatus] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mobileSheet, setMobileSheet] = useState(false);
  const [pending, startTransition] = useTransition();

  const [draftTitle, setDraftTitle] = useState("");
  const [draftDesc, setDraftDesc] = useState("");
  const [draftAssignee, setDraftAssignee] = useState(people[0]?.id ?? "");
  const [draftDue, setDraftDue] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [titleError, setTitleError] = useState("");

  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editAssignee, setEditAssignee] = useState("");
  const [editDue, setEditDue] = useState("");
  const [commentDraft, setCommentDraft] = useState("");

  const isDesktop = useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia("(min-width: 1024px)");
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(min-width: 1024px)").matches,
    () => true
  );

  const sorted = useMemo(() => sortTasks(tasks), [tasks]);
  const filtered = useMemo(
    () =>
      sorted.filter((t) => {
        const aOk = fAssignee === "all" || t.assignee_id === fAssignee;
        const sOk = fStatus === "all" || t.status === fStatus;
        return aOk && sOk;
      }),
    [sorted, fAssignee, fStatus]
  );
  const groups = useMemo(() => groupTasks(filtered), [filtered]);
  const lateCount = sorted.filter((t) => t.late).length;

  // Keep desktop selection in sync; prefer first filtered task when empty.
  const selectionOk = !!(
    activeId && filtered.some((t) => t.id === activeId)
  );
  if (isDesktop && !selectionOk) {
    const first = filtered[0];
    if (first) {
      setActiveId(first.id);
      setEditTitle(first.title);
      setEditDesc(first.description);
      setEditAssignee(first.assignee_id ?? "");
      setEditDue(first.due_date);
      setCommentDraft("");
    } else if (activeId !== null) {
      setActiveId(null);
    }
  }

  const active = activeId ? tasks.find((t) => t.id === activeId) : null;
  const activeDecorated = active ? decorateTask(active) : null;
  const comments = activeId ? (commentsByTask[activeId] ?? []) : [];
  const files = activeId ? (attachmentsByTask[activeId] ?? []) : [];

  function openDetail(task: Task) {
    setActiveId(task.id);
    setEditTitle(task.title);
    setEditDesc(task.description);
    setEditAssignee(task.assignee_id ?? "");
    setEditDue(task.due_date);
    setCommentDraft("");
    if (!isDesktop) setMobileSheet(true);
  }

  function onCreate() {
    setTitleError("");
    if (!draftTitle.trim()) {
      setTitleError("A task needs a title so people know what to do.");
      return;
    }
    if (!draftDue) {
      setTitleError("Pick a due date.");
      return;
    }
    startTransition(async () => {
      const res = await createTask({
        title: draftTitle,
        description: draftDesc,
        assignee_id: draftAssignee,
        due_date: draftDue,
      });
      if (res.error) {
        setTitleError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success("Task created");
      setCreateOpen(false);
      setDraftTitle("");
      setDraftDesc("");
      router.refresh();
    });
  }

  function saveEdits() {
    if (!activeId) return;
    if (!editTitle.trim()) {
      toast.error("A task needs a title so people know what to do.");
      return;
    }
    if (!editDue) {
      toast.error("Pick a due date.");
      return;
    }
    startTransition(async () => {
      const res = await updateTask(activeId, {
        title: editTitle.trim(),
        description: editDesc,
        assignee_id: editAssignee || null,
        due_date: editDue,
      });
      if (res.error) toast.error(res.error);
      else {
        toast.success("Saved");
        router.refresh();
      }
    });
  }

  function setStatus(status: TaskStatus) {
    if (!activeId) return;
    startTransition(async () => {
      const res = await updateTask(activeId, { status });
      if (res.error) toast.error(res.error);
      else router.refresh();
    });
  }

  function onDelete() {
    if (!activeId) return;
    if (!confirm("Delete this task?")) return;
    startTransition(async () => {
      const res = await deleteTask(activeId);
      if (res.error) toast.error(res.error);
      else {
        setActiveId(null);
        setMobileSheet(false);
        toast.success("Deleted");
        router.refresh();
      }
    });
  }

  function postComment() {
    if (!activeId) return;
    if (!commentDraft.trim()) {
      toast.error("Write a comment first.");
      return;
    }
    startTransition(async () => {
      const res = await addComment(activeId, adminId, commentDraft);
      if (res.error) toast.error(res.error);
      else {
        setCommentDraft("");
        toast.success("Comment posted");
        router.refresh();
      }
    });
  }

  async function onAttach(fileList: FileList | null) {
    if (!fileList?.[0] || !activeId) return;
    const file = fileList[0];
    if (file.size > 50 * 1024 * 1024) {
      toast.error("File must be under 50 MB.");
      return;
    }
    const fd = new FormData();
    fd.set("taskId", activeId);
    fd.set("uploadedBy", adminId);
    fd.set("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const json = (await res.json()) as { error?: string };
    if (!res.ok || json.error) toast.error(json.error || "Upload failed");
    else {
      toast.success("File attached");
      router.refresh();
    }
  }

  function removeFile(attachmentId: string) {
    if (!confirm("Remove this file?")) return;
    startTransition(async () => {
      const res = await deleteAttachment(attachmentId, adminId);
      if (res.error) toast.error(res.error);
      else {
        toast.success("File removed");
        router.refresh();
      }
    });
  }

  const detailProps = activeDecorated
    ? {
        task: activeDecorated,
        people,
        comments,
        files,
        editTitle,
        setEditTitle,
        editDesc,
        setEditDesc,
        editAssignee,
        setEditAssignee,
        editDue,
        setEditDue,
        commentDraft,
        setCommentDraft,
        pending,
        onSave: saveEdits,
        onStatus: setStatus,
        onDelete,
        onComment: postComment,
        onAttach,
        onRemoveFile: removeFile,
      }
    : null;

  const listSection = (
    <div className="min-w-0 overflow-hidden">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-[24px] font-medium tracking-[-0.02em] text-ink md:text-[26px]">
            All Tasks
          </h1>
          <p className="mt-1 font-mono text-[12px] text-ink-2">
            {sorted.length} tasks
            {lateCount ? ` · ${lateCount} overdue` : ""}
            <span className="hidden sm:inline">
              {" "}
              · overdue first, then by due date
            </span>
          </p>
        </div>
        <div className="flex min-w-0 flex-wrap gap-2">
          <Select value={fAssignee} onValueChange={setFAssignee}>
            <SelectTrigger className="glass-surface h-10 w-[min(100%,11rem)] min-w-0 border-white/70 backdrop-blur-xl dark:border-white/10">
              <SelectValue placeholder="Assignee" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">Anyone</SelectItem>
                {people.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Select value={fStatus} onValueChange={setFStatus}>
            <SelectTrigger className="glass-surface h-10 w-[min(100%,9.5rem)] min-w-0 border-white/70 backdrop-blur-xl dark:border-white/10">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">Any status</SelectItem>
                {TASK_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="glass-cta hidden h-10 shrink-0 items-center gap-1.5 rounded-[12px] px-3.5 text-[13px] font-medium transition-opacity hover:opacity-95 lg:inline-flex"
          >
            <PlusIcon className="size-4" />
            Create task
          </button>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="glass-panel px-6 py-16 text-center">
          <p className="text-[15px] font-medium text-ink">
            {sorted.length === 0 ? "No tasks yet" : "No tasks match"}
          </p>
          <p className="mt-1.5 text-[13px] text-ink-2">
            {sorted.length === 0
              ? "Create the first task for the team."
              : "Clear filters or create a new task."}
          </p>
          {sorted.length === 0 ? (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="glass-cta mt-5 inline-flex h-11 items-center gap-2 rounded-[14px] px-4 text-[14px] font-medium"
            >
              <PlusIcon className="size-4" />
              Create task
            </button>
          ) : null}
        </div>
      ) : (
        groups.map((g, gi) => (
          <div key={g.key} className={cn("min-w-0", gi > 0 && "mt-5")}>
            <div
              className={cn(
                "mb-1.5 px-1.5 text-[12px] font-medium tracking-[0.02em] uppercase",
                g.key === "overdue" ? "text-late" : "text-ink-2"
              )}
            >
              {g.label}
            </div>
            <div
              className={cn(
                "min-w-0 overflow-hidden",
                g.key === "overdue" ? "glass-panel-late" : "glass-panel"
              )}
            >
              <div
                className={cn(
                  "hidden border-b-[0.5px] px-4 py-2 font-mono text-[11px] tracking-[0.04em] uppercase md:grid",
                  DESKTOP_ROW,
                  g.key === "overdue"
                    ? "border-late/20 text-late/80"
                    : "border-ink/10 text-ink-2"
                )}
              >
                <span>Task</span>
                <span>Assignee</span>
                <span>Status</span>
                <span className="text-right">Due</span>
              </div>
              {g.tasks.map((t, i) => (
                <GlassAdminRow
                  key={t.id}
                  task={t}
                  late={g.key === "overdue"}
                  last={i === g.tasks.length - 1}
                  selected={activeId === t.id && isDesktop}
                  onClick={() => openDetail(t)}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );

  return (
    <>
      <div className="min-w-0 lg:grid lg:grid-cols-[minmax(0,1fr)_min(100%,24rem)] lg:items-start lg:gap-5 xl:grid-cols-[minmax(0,1fr)_26rem] xl:gap-6">
        {listSection}

        {/* Desktop side detail — sticky below header + banner */}
        <aside className="sticky top-[7.25rem] hidden max-h-[calc(100dvh-8rem)] min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain lg:block [scrollbar-gutter:stable]">
          {detailProps ? (
            <>
              <h2 className="mb-3 line-clamp-2 pr-1 text-[17px] leading-snug font-medium tracking-[-0.02em] text-ink">
                {detailProps.task.title}
              </h2>
              <TaskDetailEditor {...detailProps} />
              <div className="h-8" aria-hidden />
            </>
          ) : (
            <div className="glass-panel px-6 py-16 text-center">
              <p className="text-[15px] font-medium text-ink">Select a task</p>
              <p className="mt-1.5 text-[13px] text-ink-2">
                Pick one from the list to edit details, files, and comments.
              </p>
            </div>
          )}
        </aside>
      </div>

      {/* Mobile create bar */}
      <div className="glass-bar fixed right-0 bottom-0 left-0 z-30 border-t-[0.5px] border-ink/10 px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] lg:hidden">
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="glass-cta flex h-12 w-full items-center justify-center gap-2 rounded-[14px] text-[16px] font-medium tracking-[-0.01em] transition-opacity hover:opacity-95"
        >
          <PlusIcon className="size-[18px]" />
          Create task
        </button>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="border-white/60 bg-background/90 backdrop-blur-xl sm:rounded-[22px] dark:border-white/10">
          <DialogHeader>
            <DialogTitle>New task</DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <Field data-invalid={!!titleError || undefined}>
              <FieldLabel htmlFor="nt-title">Title</FieldLabel>
              <Input
                id="nt-title"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                placeholder="Send lyrics for new songs"
                className="glass-surface"
              />
              {titleError ? <FieldError>{titleError}</FieldError> : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="nt-desc">Description</FieldLabel>
              <Textarea
                id="nt-desc"
                value={draftDesc}
                onChange={(e) => setDraftDesc(e.target.value)}
                rows={3}
                className="glass-surface"
              />
            </Field>
            <Field>
              <FieldLabel>Assignee</FieldLabel>
              <Select
                value={draftAssignee || "unassigned"}
                onValueChange={(v) =>
                  setDraftAssignee(v === "unassigned" ? "" : v)
                }
              >
                <SelectTrigger className="glass-surface w-full">
                  <SelectValue placeholder="Pick someone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {people.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="nt-due">Due date</FieldLabel>
              <Input
                id="nt-due"
                type="date"
                value={draftDue}
                onChange={(e) => setDraftDue(e.target.value)}
                className="glass-surface font-mono"
                required
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-[14px]"
              disabled={pending}
              onClick={onCreate}
            >
              {pending ? "Creating…" : "Create task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mobile full-sheet detail */}
      <Sheet
        open={mobileSheet && !!active && !isDesktop}
        onOpenChange={(o) => {
          if (!o) setMobileSheet(false);
        }}
      >
        <SheetContent className="w-full overflow-y-auto border-l-white/40 bg-page/92 backdrop-blur-2xl sm:max-w-md dark:border-white/10">
          {detailProps && (
            <>
              <SheetHeader>
                <SheetTitle className="pr-8 text-left text-[20px] leading-snug tracking-[-0.02em]">
                  {detailProps.task.title}
                </SheetTitle>
              </SheetHeader>
              <div className="mt-4 px-4 pb-10">
                <TaskDetailEditor {...detailProps} />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
