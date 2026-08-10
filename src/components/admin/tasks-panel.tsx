"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createTask,
  deleteTask,
  updateTask,
  addComment,
} from "@/actions/cue";
import { TaskRow } from "@/components/cue/task-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  MentionTextarea,
  CommentBody,
} from "@/components/cue/mention-textarea";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  decorateTask,
  fileExt,
  formatBytes,
  formatDue,
  formatWhen,
  initials,
  isImageMime,
  sortTasks,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Attachment, Comment, Person, Task, TaskStatus } from "@/lib/types";
import { TASK_STATUSES } from "@/lib/types";
import { PaperclipIcon, Trash2Icon } from "lucide-react";

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

  const lateCount = sorted.filter((t) => t.late).length;
  const active = activeId ? tasks.find((t) => t.id === activeId) : null;
  const activeDecorated = active ? decorateTask(active) : null;
  const comments = activeId ? commentsByTask[activeId] ?? [] : [];
  const files = activeId ? attachmentsByTask[activeId] ?? [] : [];

  function openDetail(task: Task) {
    setActiveId(task.id);
    setEditTitle(task.title);
    setEditDesc(task.description);
    setEditAssignee(task.assignee_id ?? "");
    setEditDue(task.due_date);
    setCommentDraft("");
  }

  function onCreate() {
    setTitleError("");
    startTransition(async () => {
      const res = await createTask({
        title: draftTitle,
        description: draftDesc,
        assignee_id: draftAssignee,
        due_date: draftDue,
      });
      if (res.error) {
        setTitleError(res.error);
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
        toast.success("Deleted");
        router.refresh();
      }
    });
  }

  function postComment() {
    if (!activeId) return;
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

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-structure bg-white">
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4.5">
          <div>
            <h1 className="text-xl font-medium tracking-tight">All tasks</h1>
            <div className="mt-1 font-mono text-xs text-ink-2">
              {sorted.length} tasks · {lateCount} overdue · overdue first, then
              by due date
            </div>
          </div>
          <Button type="button" onClick={() => setCreateOpen(true)}>
            Create task
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 px-5 pb-3.5">
          <Select value={fAssignee} onValueChange={setFAssignee}>
            <SelectTrigger className="h-9 w-[180px]">
              <SelectValue placeholder="Assignee" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">Assignee: anyone</SelectItem>
                {people.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Select value={fStatus} onValueChange={setFStatus}>
            <SelectTrigger className="h-9 w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">Status: any</SelectItem>
                {TASK_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow className="border-structure hover:bg-transparent">
                <TableHead className="font-mono text-[11px] font-normal text-ink-2">
                  Task
                </TableHead>
                <TableHead className="w-[190px] font-mono text-[11px] font-normal text-ink-2">
                  Assignee
                </TableHead>
                <TableHead className="w-[130px] font-mono text-[11px] font-normal text-ink-2">
                  Status
                </TableHead>
                <TableHead className="w-[150px] text-right font-mono text-[11px] font-normal text-ink-2">
                  Due
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => (
                <TableRow
                  key={t.id}
                  className={cn(
                    "cursor-pointer border-structure",
                    t.late
                      ? "bg-late text-white hover:bg-late/95"
                      : "hover:bg-page"
                  )}
                  onClick={() => openDetail(t)}
                >
                  <TableCell
                    className={cn(
                      "text-[15px] font-medium",
                      t.status === "Done" && !t.late && "text-ink-2 line-through"
                    )}
                  >
                    {t.title}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-sm",
                      t.late ? "text-white/85" : "text-ink-2"
                    )}
                  >
                    {t.assignee?.name ?? "—"}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-sm",
                      t.late ? "text-white/85" : "text-ink-2"
                    )}
                  >
                    {t.status}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-mono text-[13.5px]",
                      t.late ? "font-medium text-white" : "text-ink-2"
                    )}
                  >
                    {t.dateLabel}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Mobile list */}
        <div className="md:hidden">
          {filtered.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              meta={`${t.assignee?.name ?? "Unassigned"} · ${t.status}`}
              onClick={() => openDetail(t)}
            />
          ))}
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
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
              />
            </Field>
            <Field>
              <FieldLabel>Assignee</FieldLabel>
              <Select value={draftAssignee} onValueChange={setDraftAssignee}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pick someone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
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
                className="font-mono"
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
            <Button type="button" disabled={pending} onClick={onCreate}>
              Create task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={!!active} onOpenChange={(o) => !o && setActiveId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {activeDecorated && (
            <>
              <SheetHeader>
                <SheetTitle className="pr-8 text-left leading-snug">
                  {activeDecorated.title}
                </SheetTitle>
              </SheetHeader>

              <div className="mt-4 flex flex-col gap-4 px-4 pb-8">
                {activeDecorated.late && (
                  <div className="rounded-md bg-late px-3 py-2.5 text-sm font-medium text-white">
                    {activeDecorated.dateLabel} · due{" "}
                    {formatDue(activeDecorated.due_date)}
                  </div>
                )}

                <FieldGroup>
                  <Field>
                    <FieldLabel>Title</FieldLabel>
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Description</FieldLabel>
                    <Textarea
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      rows={3}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Assignee</FieldLabel>
                    <Select
                      value={editAssignee}
                      onValueChange={setEditAssignee}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
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
                      className="font-mono"
                    />
                  </Field>
                </FieldGroup>

                <div>
                  <div className="mb-2 text-[13px] text-ink-2">Status</div>
                  <div className="flex gap-1.5">
                    {TASK_STATUSES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setStatus(s)}
                        className={cn(
                          "h-10 flex-1 rounded-md border text-sm",
                          activeDecorated.status === s
                            ? "border-ink bg-ink font-medium text-white"
                            : "border-structure bg-white"
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button type="button" disabled={pending} onClick={saveEdits}>
                    Save changes
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="text-late"
                    disabled={pending}
                    onClick={onDelete}
                  >
                    <Trash2Icon data-icon="inline-start" />
                    Delete
                  </Button>
                </div>

                <div>
                  <div className="mb-2 flex items-baseline justify-between">
                    <span className="text-[13px] text-ink-2">Files</span>
                    <span className="font-mono text-xs text-ink-2">
                      {files.length || "none yet"}
                    </span>
                  </div>
                  {files.map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center gap-3 border-b border-structure py-2"
                    >
                      <div className="grid size-9 place-items-center rounded border border-structure font-mono text-[9px] text-ink-2">
                        {isImageMime(f.mime_type, f.name)
                          ? "IMG"
                          : fileExt(f.name)}
                      </div>
                      <div className="min-w-0 flex-1 truncate text-sm">
                        {f.name}
                        <div className="font-mono text-xs text-ink-2">
                          {formatBytes(f.size_bytes)}
                        </div>
                      </div>
                    </div>
                  ))}
                  <label className="mt-3 flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-structure text-sm font-medium">
                    <PaperclipIcon className="size-4" />
                    Attach file
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        void onAttach(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>

                <div>
                  <div className="mb-2 flex items-baseline justify-between">
                    <span className="text-[13px] text-ink-2">Comments</span>
                    <span className="font-mono text-xs text-ink-2">
                      {comments.length || "none yet"}
                    </span>
                  </div>
                  {comments.map((c) => (
                    <div
                      key={c.id}
                      className="flex gap-2 border-b border-structure py-3"
                    >
                      <div className="grid size-6 shrink-0 place-items-center rounded-full border border-structure font-mono text-[10px] text-ink-2">
                        {initials(c.author?.name ?? "?")}
                      </div>
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
                    className="mt-3"
                    rows={2}
                    people={people}
                    value={commentDraft}
                    onChange={setCommentDraft}
                    placeholder="Type @ to mention someone"
                  />
                  <Button
                    type="button"
                    className="mt-2"
                    disabled={pending}
                    onClick={postComment}
                  >
                    Post comment
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
