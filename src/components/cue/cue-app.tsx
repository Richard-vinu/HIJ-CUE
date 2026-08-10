"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, PaperclipIcon, DownloadIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";
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
import { addComment, updateTask } from "@/actions/cue";
import {
  decorateTask,
  fileExt,
  formatBytes,
  formatDue,
  formatWhen,
  groupTasks,
  initials,
  isImageMime,
  sortTasks,
  type DecoratedTask,
} from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Attachment, Comment, Person, Task, TaskStatus } from "@/lib/types";
import { TASK_STATUSES } from "@/lib/types";

type Screen = "list" | "detail";
type Tab = "my" | "all";

function GlassRow({
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
          : "border-ink/10 hover:bg-white/40",
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
            "mt-0.5 text-[13px]",
            late ? "text-late" : "text-ink-2"
          )}
        >
          {task.assignee?.name ?? "Unassigned"} · {task.status}
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

export function CueApp({
  people,
  tasks: initialTasks,
  commentsByTask,
  attachmentsByTask,
}: {
  people: Person[];
  tasks: Task[];
  commentsByTask: Record<string, Comment[]>;
  attachmentsByTask: Record<string, Attachment[]>;
}) {
  const { me, setMeId } = useMe();
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

  const listTasks = useMemo(() => {
    if (tab === "my") return sorted.filter((t) => t.assignee_id === me?.id);
    return sorted.filter((t) => {
      const aOk = fAssignee === "all" || t.assignee_id === fAssignee;
      const sOk = fStatus === "all" || t.status === fStatus;
      return aOk && sOk;
    });
  }, [sorted, tab, me?.id, fAssignee, fStatus]);

  const groups = useMemo(() => groupTasks(listTasks), [listTasks]);

  const active = activeId
    ? decorateTask(
        initialTasks.find((t) => t.id === activeId) ?? initialTasks[0]
      )
    : null;

  const comments = activeId ? commentsByTask[activeId] ?? [] : [];
  const files = activeId ? attachmentsByTask[activeId] ?? [] : [];

  function openTask(id: string) {
    setActiveId(id);
    setCommentDraft("");
    setScreen("detail");
  }

  function setStatus(status: TaskStatus) {
    if (!activeId) return;
    startTransition(async () => {
      const res = await updateTask(activeId, { status });
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

  const listBody = (
    <div className="mx-auto w-full max-w-[720px] px-4 pb-4 pt-[18px] md:max-w-[880px] md:px-0">
      {tab === "all" && (
        <div className="mb-4 flex gap-2">
          <Select value={fAssignee} onValueChange={setFAssignee}>
            <SelectTrigger className="h-10 flex-1 border-white/70 bg-white/50 backdrop-blur-xl md:max-w-[200px]">
              <SelectValue placeholder="Anyone" />
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
            <SelectTrigger className="h-10 flex-1 border-white/70 bg-white/50 backdrop-blur-xl md:max-w-[180px]">
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
          <p className="mt-1.5 text-[13px] text-ink-2">
            {tab === "my"
              ? "When someone assigns you something it lands here."
              : "Clear the assignee or status filter."}
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
                <GlassRow
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
    </div>
  );

  const detailBody = active ? (
    <div className="mx-auto w-full max-w-[720px] px-4 py-5 pb-28 md:max-w-[720px] md:px-0">
      <div className="mb-3 md:hidden">
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
            <div className="grid size-7 place-items-center rounded-full bg-ink/5 font-mono text-[10.5px] text-ink-2">
              {initials(active.assignee?.name ?? "?")}
            </div>
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

        <div className="mt-5 mb-2 text-[13px] text-ink-2">Status</div>
        <div className="glass-segment flex gap-0.5 rounded-[12px] p-0.5">
          {TASK_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              disabled={pending}
              onClick={() => setStatus(s)}
              className={cn(
                "h-[38px] flex-1 rounded-[10px] text-sm transition-all",
                active.status === s
                  ? "bg-white/90 font-medium text-ink shadow-[0_1px_3px_rgba(16,23,41,0.12)]"
                  : "text-ink-2"
              )}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="mt-6 mb-1.5 text-[13px] text-ink-2">Description</div>
        <p className="text-[15px] leading-relaxed text-pretty text-ink">
          {active.description || "No description."}
        </p>
      </div>

      <div className="mt-5 glass-panel overflow-hidden">
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
          </div>
        ))}
        <div className="p-4 pt-2">
          <label className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-[14px] bg-ink text-[14.5px] font-medium text-white shadow-[0_6px_16px_rgba(16,23,41,0.2)]">
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

      <div className="mt-5 glass-panel overflow-hidden px-4 pt-4 pb-5">
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
            <div className="grid size-7 shrink-0 place-items-center rounded-full bg-ink/5 font-mono text-[10.5px] text-ink-2">
              {initials(c.author?.name ?? "?")}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-[13.5px] font-medium">{c.author?.name}</span>
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
          className="mt-3 border-white/80 bg-white/60"
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

  return (
    <div className="glass-ambient relative flex min-h-dvh flex-col overflow-hidden">
      {/* Ambient light blobs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-10 -left-36 size-[520px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.95),rgba(255,255,255,0)_70%)] blur-[40px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-28 -bottom-10 size-[380px] rounded-full bg-[radial-gradient(circle,rgba(90,97,114,0.35),rgba(90,97,114,0)_70%)] blur-[50px]"
      />

      {/* Glass top bar */}
      <header className="glass-bar sticky top-0 z-30 border-b-[0.5px] border-ink/12">
        <div className="mx-auto flex h-14 max-w-[880px] items-center gap-2.5 px-4 md:h-16 md:px-0">
          <div className="grid size-[30px] place-items-center rounded-full bg-ink/8 font-mono text-[10px] font-medium text-ink">
            HIJ
          </div>
          <div className="text-[19px] font-medium tracking-[-0.02em] text-ink">
            HIJ Cue
          </div>
          <div className="flex-1" />
          <button
            type="button"
            title="Switch person"
            onClick={() => setMeId(null)}
            className="grid size-8 place-items-center rounded-full bg-ink/8 font-mono text-[12px] font-medium text-ink transition-colors hover:bg-ink/12"
          >
            {me ? initials(me.name) : "?"}
          </button>
        </div>
      </header>

      {screen === "list" && (
        <>
          <div className="relative z-10 px-4 pt-3.5 md:mx-auto md:w-full md:max-w-[880px] md:px-0">
            <div className="glass-segment flex rounded-[12px] p-0.5">
              {(
                [
                  ["my", "My tasks"],
                  ["all", "All tasks"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={cn(
                    "flex h-[38px] flex-1 items-center justify-center rounded-[10px] text-[14px] transition-all",
                    tab === key
                      ? "bg-white/90 font-medium text-ink shadow-[0_1px_3px_rgba(16,23,41,0.12)]"
                      : "text-ink-2"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="relative z-10 min-h-0 flex-1 overflow-y-auto pb-28">
            {listBody}
          </div>

          <div className="glass-bar fixed right-0 bottom-0 left-0 z-30 border-t-[0.5px] border-ink/10 px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <div className="mx-auto max-w-[880px]">
              <a
                href="/admin/login"
                className="flex h-12 items-center justify-center gap-2 rounded-[14px] bg-ink text-[16px] font-medium tracking-[-0.01em] text-white shadow-[0_6px_16px_rgba(16,23,41,0.28)] transition-opacity hover:opacity-95"
              >
                <PlusIcon className="size-[18px]" />
                Create task
              </a>
            </div>
          </div>
        </>
      )}

      {screen === "detail" && (
        <div className="relative z-10 min-h-0 flex-1 overflow-y-auto pb-8">
          <div className="hidden px-0 pt-4 md:mx-auto md:block md:w-full md:max-w-[880px]">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mb-2 text-ink-2"
              onClick={() => setScreen("list")}
            >
              <ArrowLeftIcon data-icon="inline-start" />
              Back to list
            </Button>
          </div>
          {detailBody}
        </div>
      )}
    </div>
  );
}

/** @deprecated */
export const MobileCueApp = CueApp;
