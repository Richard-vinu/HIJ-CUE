"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, PaperclipIcon, DownloadIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { HijBrandLockup, HijLogo } from "@/components/brand/hij-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { PersonAvatar } from "@/components/person-avatar";
import { EventMarquee } from "@/components/event-marquee";
import { TeamProfileMenu } from "@/components/profile-menu";
import { useMe } from "@/components/cue/me-provider";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MentionTextarea,
  CommentBody,
} from "@/components/cue/mention-textarea";
import { StatusSelect } from "@/components/cue/status-select";
import { EventsPanel } from "@/components/cue/events-panel";
import { addComment, deleteAttachment, updateTask } from "@/actions/cue";
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
import type { CueEvent } from "@/lib/events";

type Screen = "list" | "detail";
type Tab = "my" | "all" | "team" | "events";

function GlassRowMobile({
  task,
  late,
  onClick,
  last,
}: {
  task: DecoratedTask;
  late?: boolean;
  onClick: () => void;
  last?: boolean;
}) {
  const done = task.status === "Done";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors",
        late
          ? "border-late/25 hover:bg-late/[0.06]"
          : "border-ink/10 hover:bg-white/40 dark:hover:bg-white/[0.04]",
        !last && "border-b-[0.5px]"
      )}
    >
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "text-[15.5px] font-medium tracking-[-0.01em] text-ink",
            done && "text-ink-2 line-through"
          )}
        >
          {task.title}
        </div>
        <div
          className={cn(
            "mt-0.5 flex flex-wrap items-center gap-1.5 text-[13px]",
            late ? "text-late" : "text-ink-2"
          )}
        >
          <span className="min-w-0 truncate">
            {task.assignee?.name ?? "Unassigned"}
          </span>
          <span
            className={cn(
              "inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 font-mono text-[11px] font-medium leading-none",
              statusClasses(task.status).trigger
            )}
          >
            {task.status}
          </span>
        </div>
      </div>
      <div
        className={cn(
          "shrink-0 font-mono text-[13px] tabular-nums",
          late ? "font-medium text-late" : "text-ink-2"
        )}
      >
        {task.shortDateLabel}
      </div>
    </button>
  );
}

function BoardCard({
  task,
  onClick,
}: {
  task: DecoratedTask;
  onClick: () => void;
}) {
  const done = task.status === "Done";
  const late = task.late;
  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/task-id", task.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={onClick}
      className={cn(
        "w-full rounded-[14px] px-3.5 py-3 text-left transition-colors",
        late
          ? "glass-panel-late !rounded-[14px] hover:brightness-[0.98]"
          : "glass-panel !rounded-[14px] hover:bg-white/70 dark:hover:bg-white/[0.1]"
      )}
    >
      <div
        className={cn(
          "text-[14.5px] leading-snug font-medium tracking-[-0.01em] text-ink",
          done && "text-ink-2 line-through"
        )}
      >
        {task.title}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <PersonAvatar
            person={task.assignee ?? { name: "?" }}
            size={20}
            className={late ? "ring-1 ring-late/40" : undefined}
          />
          <span
            className={cn(
              "truncate text-[12.5px]",
              late ? "text-late" : "text-ink-2"
            )}
          >
            {task.assignee?.name ?? "Unassigned"}
          </span>
        </div>
        <span
          className={cn(
            "shrink-0 font-mono text-[12px] tabular-nums",
            late ? "font-medium text-late" : "text-ink-2"
          )}
        >
          {task.dateLabel}
        </span>
      </div>
    </button>
  );
}

function StatusColumn({
  status,
  label,
  tasks,
  onOpen,
  onDropStatus,
}: {
  status: TaskStatus;
  label: string;
  tasks: DecoratedTask[];
  onOpen: (id: string) => void;
  onDropStatus: (taskId: string, status: TaskStatus) => void;
}) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-1 flex-col rounded-[18px] transition-colors",
        dragOver && "bg-ink/[0.04] dark:bg-white/[0.04]"
      )}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const id = e.dataTransfer.getData("text/task-id");
        if (id) onDropStatus(id, status);
      }}
    >
      <div className="mb-3 flex items-baseline justify-between px-1">
        <h3 className="text-[13px] font-medium tracking-[0.02em] text-ink-2 uppercase">
          {label}
        </h3>
        <span className="font-mono text-[12px] text-ink-2 tabular-nums">
          {tasks.length}
        </span>
      </div>
      <div className="glass-segment flex min-h-[280px] flex-1 flex-col gap-2.5 overflow-y-auto rounded-[18px] p-2.5">
        {tasks.length === 0 ? (
          <div className="flex flex-1 items-center justify-center px-3 py-8 text-center text-[13px] text-ink-2">
            No tasks
          </div>
        ) : (
          tasks.map((t) => (
            <BoardCard key={t.id} task={t} onClick={() => onOpen(t.id)} />
          ))
        )}
      </div>
    </div>
  );
}

export function CueApp({
  people,
  tasks: initialTasks,
  commentsByTask,
  attachmentsByTask,
  bannerMessage,
  events,
}: {
  people: Person[];
  tasks: Task[];
  commentsByTask: Record<string, Comment[]>;
  attachmentsByTask: Record<string, Attachment[]>;
  bannerMessage: string;
  events: CueEvent[];
}) {
  const { me } = useMe();
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>("list");
  const [tab, setTab] = useState<Tab>("my");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [fAssignee, setFAssignee] = useState("all");
  const [fStatus, setFStatus] = useState("all");
  const [commentDraft, setCommentDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);

  const sorted = useMemo(() => sortTasks(initialTasks), [initialTasks]);

  const myTasks = useMemo(
    () => sorted.filter((t) => t.assignee_id === me?.id),
    [sorted, me?.id]
  );
  const myLate = myTasks.filter((t) => t.late).length;
  const allOpen = sorted.filter((t) => t.status !== "Done").length;

  const personStats = useMemo(() => {
    return people.map((p) => {
      const open = sorted.filter(
        (t) => t.assignee_id === p.id && t.status !== "Done"
      );
      const late = open.filter((t) => t.late).length;
      return { person: p, open: open.length, late };
    });
  }, [people, sorted]);

  const listTasks = useMemo(() => {
    if (tab === "my") return myTasks;
    if (tab === "team" || tab === "events") return [];
    return sorted.filter((t) => {
      const aOk = fAssignee === "all" || t.assignee_id === fAssignee;
      const sOk = fStatus === "all" || t.status === fStatus;
      return aOk && sOk;
    });
  }, [sorted, tab, myTasks, fAssignee, fStatus]);

  // Desktop board ignores status filter — columns are the statuses
  const boardTasks = useMemo(() => {
    if (tab === "my") return myTasks;
    if (tab === "team" || tab === "events") return [];
    return sorted.filter(
      (t) => fAssignee === "all" || t.assignee_id === fAssignee
    );
  }, [sorted, tab, myTasks, fAssignee]);

  const groups = useMemo(() => groupTasks(listTasks), [listTasks]);

  const boardColumns = useMemo(() => {
    const byStatus: Record<TaskStatus, DecoratedTask[]> = {
      "To do": [],
      "In progress": [],
      Done: [],
    };
    for (const t of boardTasks) {
      byStatus[t.status].push(t);
    }
    return byStatus;
  }, [boardTasks]);

  const active = activeId
    ? decorateTask(
        initialTasks.find((t) => t.id === activeId) ?? initialTasks[0]
      )
    : null;

  const comments = activeId ? (commentsByTask[activeId] ?? []) : [];
  const files = activeId ? (attachmentsByTask[activeId] ?? []) : [];

  function openTask(id: string) {
    setActiveId(id);
    setCommentDraft("");
    setScreen("detail");
  }

  function selectPerson(id: string) {
    setTab("all");
    setFAssignee(id);
    setFStatus("all");
    setScreen("list");
  }

  function setStatus(status: TaskStatus) {
    if (!activeId) return;
    startTransition(async () => {
      const res = await updateTask(activeId, { status });
      if (res.error) toast.error(res.error);
      else router.refresh();
    });
  }

  function moveTaskStatus(taskId: string, status: TaskStatus) {
    const task = initialTasks.find((t) => t.id === taskId);
    if (!task || task.status === status) return;
    startTransition(async () => {
      const res = await updateTask(taskId, { status });
      if (res.error) toast.error(res.error);
      else router.refresh();
    });
  }

  function postComment() {
    if (!activeId || !me) return;
    startTransition(async () => {
      const res = await addComment(activeId, me.id, commentDraft);
      if (res.error) toast.error(res.error);
      else {
        setCommentDraft("");
        toast.success("Comment posted");
        router.refresh();
      }
    });
  }

  async function onAttach(fileList: FileList | null) {
    if (!fileList?.[0] || !activeId || !me) return;
    const file = fileList[0];
    if (file.size > 50 * 1024 * 1024) {
      toast.error("File must be under 50 MB.");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("taskId", activeId);
      fd.set("uploadedBy", me.id);
      fd.set("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = (await res.json()) as { error?: string };
      if (!res.ok || json.error) toast.error(json.error || "Upload failed");
      else {
        toast.success("File attached");
        router.refresh();
      }
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function downloadFile(path: string, name: string) {
    const supabase = createClient();
    const { data, error } = await supabase.storage
      .from("task-files")
      .createSignedUrl(path, 60);
    if (error || !data?.signedUrl) {
      toast.error(error?.message || "Could not download file");
      return;
    }
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = name;
    a.target = "_blank";
    a.click();
  }

  function removeFile(attachmentId: string) {
    if (!confirm("Remove this file?")) return;
    startTransition(async () => {
      const res = await deleteAttachment(attachmentId, me?.id);
      if (res.error) toast.error(res.error);
      else {
        toast.success("File removed");
        router.refresh();
      }
    });
  }

  const title =
    tab === "my"
      ? "My tasks"
      : tab === "team"
        ? "Team"
        : tab === "events"
          ? "Events"
          : "All tasks";
  const boardLate = boardTasks.filter((t) => t.late).length;
  const subtitle =
    tab === "my"
      ? `${myTasks.length} tasks${myLate ? ` · ${myLate} overdue` : ""}`
      : tab === "team"
        ? `${people.length} people`
        : tab === "events"
          ? `${events.length} events`
          : `${boardTasks.length} tasks${boardLate ? ` · ${boardLate} overdue` : ""}`;

  const filters = (
    <Select value={fAssignee} onValueChange={setFAssignee}>
      <SelectTrigger className="glass-surface h-8 w-[160px] border-white/70 text-[13px] dark:border-white/10">
        <SelectValue placeholder="All" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value="all">All</SelectItem>
          {people.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );

  const desktopBoard = (
    <div className="flex h-full min-h-0 gap-4">
      {(
        [
          ["To do", "To do"],
          ["In progress", "In progress"],
          ["Done", "Completed"],
        ] as const
      ).map(([status, label]) => (
        <StatusColumn
          key={status}
          status={status}
          label={label}
          tasks={boardColumns[status]}
          onOpen={openTask}
          onDropStatus={moveTaskStatus}
        />
      ))}
    </div>
  );

  const teamPane = (
    <div className="space-y-5">
      <div className="glass-panel overflow-hidden !rounded-[16px]">
        {personStats.map(({ person: p, open, late }, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => selectPerson(p.id)}
            className={cn(
              "flex min-h-[56px] w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-white/40 dark:hover:bg-white/[0.04]",
              i < personStats.length - 1 && "border-b-[0.5px] border-ink/10"
            )}
          >
            <PersonAvatar person={p} size={36} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="truncate text-[14.5px] font-medium text-ink">
                  {p.name}
                </span>
                {p.is_admin ? (
                  <span className="rounded-full bg-ink/8 px-1.5 py-0.5 font-mono text-[10px] text-ink-2">
                    admin
                  </span>
                ) : null}
              </div>
              <div className="mt-0.5 text-[12.5px] text-ink-2">
                {p.role?.trim() ? p.role : "Role not set"}
              </div>
            </div>
            <div
              className={cn(
                "shrink-0 font-mono text-[13px] tabular-nums",
                late > 0 ? "text-late" : "text-ink-2"
              )}
            >
              {open} open{late > 0 ? ` · ${late} late` : ""}
            </div>
          </button>
        ))}
      </div>
      <p className="px-1 text-[12.5px] text-ink-2">
        Roles are set by admins on the Team admin page.
      </p>
    </div>
  );

  const detailBody = active ? (
    <div className="w-full max-w-[720px] px-4 py-5 pb-28 lg:px-0 lg:pb-8">
      <div className="mb-3 lg:hidden">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-ml-2 text-ink-2"
          onClick={() => setScreen("list")}
        >
          <ArrowLeftIcon data-icon="inline-start" />
          Back
        </Button>
      </div>

      <div className="glass-panel px-5 py-5">
        <h2 className="text-[22px] leading-snug font-medium tracking-[-0.02em] text-ink md:text-[26px]">
          {active.title}
        </h2>

        {active.late && (
          <div className="mt-4 flex items-baseline gap-2 rounded-[14px] bg-late/15 px-3.5 py-2.5">
            <span className="text-sm font-medium text-late">
              {active.dateLabel}
            </span>
            <span className="font-mono text-xs text-late/80">
              due {formatDue(active.due_date)}
            </span>
          </div>
        )}

        <div className="mt-5 border-t border-ink/10">
          <div className="flex items-center gap-3 border-b border-ink/10 py-3.5">
            <div className="w-[88px] shrink-0 text-[13px] text-ink-2">
              Assignee
            </div>
            <PersonAvatar
              person={active.assignee ?? { name: "?" }}
              size={28}
            />
            <div className="flex-1 text-[15px]">
              {active.assignee?.name ?? "Unassigned"}
            </div>
          </div>
          <div className="flex items-center gap-3 py-3.5">
            <div className="w-[88px] shrink-0 text-[13px] text-ink-2">Due</div>
            <div
              className={cn(
                "flex-1 font-mono text-sm",
                active.late ? "text-late" : "text-ink"
              )}
            >
              {formatDue(active.due_date)}
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <div className="w-[88px] shrink-0 text-[13px] text-ink-2">Status</div>
          <StatusSelect
            value={active.status}
            onValueChange={setStatus}
            disabled={pending}
          />
        </div>

        <div className="mt-6 mb-1.5 text-[13px] text-ink-2">Description</div>
        <p className="text-[15px] leading-relaxed text-pretty text-ink">
          {active.description || "No description."}
        </p>
      </div>

      <div className="glass-panel mt-5 overflow-hidden">
        <div className="flex items-baseline justify-between px-4 pt-4 pb-2">
          <div className="text-[13px] text-ink-2">Files</div>
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
            <div className="grid size-10 shrink-0 place-items-center rounded-[8px] bg-ink/5 font-mono text-[9px] text-ink-2">
              {isImageMime(f.mime_type, f.name) ? "IMG" : fileExt(f.name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{f.name}</div>
              <div className="mt-0.5 font-mono text-xs text-ink-2">
                {formatBytes(f.size_bytes)}
                {f.uploader ? ` · ${f.uploader.name}` : ""}
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Download"
              onClick={() => downloadFile(f.storage_path, f.name)}
            >
              <DownloadIcon />
            </Button>
            {(me?.id === f.uploaded_by || !f.uploaded_by) && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove file"
                disabled={pending}
                className="text-ink-2 hover:text-late"
                onClick={() => removeFile(f.id)}
              >
                <Trash2Icon />
              </Button>
            )}
          </div>
        ))}
        {files.length === 0 ? (
          <p className="px-4 pb-2 text-[13px] text-ink-2">No files yet.</p>
        ) : null}
        <div className="p-4 pt-2">
          <label className="glass-cta flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-[14px] text-[14.5px] font-medium">
            <PaperclipIcon className="size-4.5" />
            {uploading ? "Uploading…" : "Attach file"}
            <input
              type="file"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                void onAttach(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </div>

      <div className="glass-panel mt-5 overflow-hidden px-4 pt-4 pb-5">
        <div className="mb-2 flex items-baseline justify-between">
          <div className="text-[13px] text-ink-2">Comments</div>
          <span className="font-mono text-xs text-ink-2">
            {comments.length || "none yet"}
          </span>
        </div>
        {comments.map((c) => (
          <div
            key={c.id}
            className="flex gap-2.5 border-b-[0.5px] border-ink/10 py-3.5 last:border-0"
          >
            <PersonAvatar
              person={c.author ?? { name: "?" }}
              size={28}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-[13.5px] font-medium">
                  {c.author?.name}
                </span>
                <span className="font-mono text-[11.5px] text-ink-2">
                  {formatWhen(c.created_at)}
                </span>
              </div>
              <p className="mt-1 text-[14.5px] leading-relaxed text-pretty">
                <CommentBody text={c.body} />
              </p>
            </div>
          </div>
        ))}
        <MentionTextarea
          people={people}
          value={commentDraft}
          onChange={setCommentDraft}
          rows={2}
          placeholder="Type @ to mention someone"
          className="glass-surface mt-3 border-white/80 dark:border-white/10"
        />
        <Button
          type="button"
          className="mt-2 h-11 rounded-[14px]"
          disabled={pending}
          onClick={postComment}
        >
          Post comment
        </Button>
      </div>
    </div>
  ) : null;

  /* ——— Desktop 3a ——— */
  const desktop = (
    <div className="relative z-10 hidden min-h-dvh lg:flex">
      <aside className="glass-rail flex w-[236px] shrink-0 flex-col gap-[22px] border-r-[0.5px] border-ink/10 px-3.5 py-[18px]">
        <div className="flex items-center gap-2.5 px-1.5">
          <HijLogo size={40} priority />
          <div className="min-w-0">
            <div className="text-[17px] font-medium tracking-[-0.02em] text-ink">
              HIJ Cue
            </div>
            <div className="mt-1 font-mono text-[10px] tracking-[0.1em] text-ink-2 uppercase">
              White Clouds Media
            </div>
          </div>
        </div>

        <nav className="flex flex-col gap-0.5">
          <button
            type="button"
            onClick={() => {
              setTab("my");
              setScreen("list");
            }}
            className={cn(
              "flex h-9 items-center justify-between rounded-[9px] px-2.5 text-[14px] transition-colors",
              tab === "my" && screen === "list"
                ? "glass-pill-active font-medium"
                : "text-ink-2 hover:bg-white/40 dark:hover:bg-white/[0.04]"
            )}
          >
            <span>My tasks</span>
            {myLate > 0 ? (
              <span className="font-mono text-[12px] text-late tabular-nums">
                {myLate} late
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("all");
              setFAssignee("all");
              setScreen("list");
            }}
            className={cn(
              "flex h-9 items-center justify-between rounded-[9px] px-2.5 text-[14px] transition-colors",
              tab === "all" && screen === "list"
                ? "glass-pill-active font-medium"
                : "text-ink-2 hover:bg-white/40 dark:hover:bg-white/[0.04]"
            )}
          >
            <span>All tasks</span>
            <span className="font-mono text-[12px] tabular-nums">{allOpen}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("events");
              setScreen("list");
            }}
            className={cn(
              "flex h-9 items-center rounded-[9px] px-2.5 text-[14px] transition-colors",
              tab === "events" && screen === "list"
                ? "glass-pill-active font-medium"
                : "text-ink-2 hover:bg-white/40 dark:hover:bg-white/[0.04]"
            )}
          >
            Events
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("team");
              setScreen("list");
            }}
            className={cn(
              "flex h-9 items-center rounded-[9px] px-2.5 text-[14px] transition-colors",
              tab === "team" && screen === "list"
                ? "glass-pill-active font-medium"
                : "text-ink-2 hover:bg-white/40 dark:hover:bg-white/[0.04]"
            )}
          >
            Team
          </button>
        </nav>

        <div>
          <div className="mb-2 px-2.5 text-[11px] font-medium tracking-[0.04em] text-ink-2 uppercase">
            People
          </div>
          <div className="flex flex-col gap-px">
            {personStats.map(({ person: p, open, late }) => (
              <button
                key={p.id}
                type="button"
                onClick={() => selectPerson(p.id)}
                className={cn(
                  "flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] text-ink transition-colors hover:bg-white/45 dark:hover:bg-white/[0.05]",
                  fAssignee === p.id &&
                    tab === "all" &&
                    "bg-white/55 dark:bg-white/[0.08]"
                )}
              >
                <PersonAvatar person={p} size={20} />
                <span className="min-w-0 flex-1 truncate text-left">
                  {p.name}
                </span>
                <span
                  className={cn(
                    "font-mono text-[11.5px] tabular-nums",
                    late > 0 ? "text-late" : "text-ink-2"
                  )}
                >
                  {open}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1" />

        <TeamProfileMenu showName />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass-bar flex h-[60px] shrink-0 items-center gap-3 border-b-[0.5px] border-ink/10 px-[22px]">
          {screen === "detail" ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="-ml-2 text-ink-2"
                onClick={() => setScreen("list")}
              >
                <ArrowLeftIcon data-icon="inline-start" />
                Back
              </Button>
              <div className="min-w-0 flex-1 truncate text-[18px] font-medium tracking-[-0.02em] text-ink">
                {active?.title}
              </div>
              <ThemeToggle />
              <TeamProfileMenu />
            </>
          ) : (
            <>
              <div className="text-[18px] font-medium tracking-[-0.02em] text-ink">
                {title}
              </div>
              <div className="text-[13px] text-ink-2">{subtitle}</div>
              <div className="flex-1" />
              {tab === "all" ? filters : null}
              <ThemeToggle />
              <TeamProfileMenu />
            </>
          )}
        </header>

        {screen === "list" && tab !== "events" ? (
          <div className="shrink-0 px-[22px] pt-3">
            <EventMarquee message={bannerMessage} />
          </div>
        ) : null}

        <div
          className={cn(
            "min-h-0 flex-1 px-[22px] py-4",
            screen === "list" && tab !== "team" && tab !== "events"
              ? "flex flex-col overflow-hidden"
              : "overflow-y-auto"
          )}
        >
          {screen === "detail"
            ? detailBody
            : tab === "team"
              ? teamPane
              : tab === "events"
                ? (
                    <EventsPanel
                      events={events}
                      tasks={initialTasks}
                      canManage={false}
                      onOpenTask={(id) => {
                        setActiveId(id);
                        setScreen("detail");
                      }}
                    />
                  )
                : desktopBoard}
        </div>
      </div>
    </div>
  );

  /* ——— Mobile (unchanged glass list) ——— */
  const mobile = (
    <div className="relative z-10 flex min-h-dvh flex-col lg:hidden">
      <header className="glass-bar sticky top-0 z-30 border-b-[0.5px] border-ink/12">
        <div className="flex h-14 items-center gap-2 px-3 sm:gap-2.5 sm:px-4">
          <HijBrandLockup
            markSize={36}
            priority
            className="min-w-0 shrink"
            titleClassName="text-[16px] sm:text-[18px]"
          />
          <div className="flex-1" />
          <ThemeToggle className="shrink-0" />
          <TeamProfileMenu />
        </div>
      </header>

      {screen === "list" && (
        <>
          <div className="px-4 pt-3.5">
            <div className="glass-segment flex rounded-[12px] p-0.5">
              {(
                [
                  ["my", "My tasks"],
                  ["all", "All tasks"],
                  ["events", "Events"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={cn(
                    "flex h-[38px] flex-1 items-center justify-center rounded-[10px] text-[13px] transition-all sm:text-[14px]",
                    tab === key
                      ? "glass-pill-active font-medium"
                      : "text-ink-2"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {tab !== "events" ? (
            <div className="px-4 pt-3">
              <EventMarquee message={bannerMessage} />
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-[18px] pb-8">
            {tab === "events" ? (
              <EventsPanel
                events={events}
                tasks={initialTasks}
                canManage={false}
                onOpenTask={(id) => {
                  setActiveId(id);
                  setScreen("detail");
                }}
              />
            ) : (
              <>
            {tab === "all" && (
              <div className="mb-4 flex gap-2">
                <Select value={fAssignee} onValueChange={setFAssignee}>
                  <SelectTrigger className="glass-surface h-10 flex-1 border-white/70 backdrop-blur-xl dark:border-white/10">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="all">All</SelectItem>
                      {people.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Select value={fStatus} onValueChange={setFStatus}>
                  <SelectTrigger className="glass-surface h-10 flex-1 border-white/70 backdrop-blur-xl dark:border-white/10">
                    <SelectValue placeholder="Any status" />
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
              </div>
            )}

            {groups.length === 0 ? (
              <div className="glass-panel px-6 py-16 text-center">
                <p className="text-[15px] font-medium text-ink">
                  {tab === "my"
                    ? "No tasks assigned to you yet"
                    : "Nothing matches those filters"}
                </p>
              </div>
            ) : (
              groups.map((g, gi) => (
                <div key={g.key} className={cn(gi > 0 && "mt-5")}>
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
                      "overflow-hidden",
                      g.key === "overdue" ? "glass-panel-late" : "glass-panel"
                    )}
                  >
                    {g.tasks.map((t, i) => (
                      <GlassRowMobile
                        key={t.id}
                        task={t}
                        late={g.key === "overdue"}
                        last={i === g.tasks.length - 1}
                        onClick={() => openTask(t.id)}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
              </>
            )}
          </div>
        </>
      )}

      {screen === "detail" && (
        <div className="min-h-0 flex-1 overflow-y-auto pb-8">{detailBody}</div>
      )}
    </div>
  );

  return (
    <div className="glass-ambient relative min-h-dvh overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-10 -left-36 size-[520px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.95),rgba(255,255,255,0)_70%)] blur-[40px] dark:opacity-20"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-28 -bottom-10 size-[380px] rounded-full bg-[radial-gradient(circle,rgba(90,97,114,0.35),rgba(90,97,114,0)_70%)] blur-[50px] dark:opacity-40"
      />
      {desktop}
      {mobile}
    </div>
  );
}

/** @deprecated */
export const MobileCueApp = CueApp;
