import { differenceInCalendarDays, format, parseISO } from "date-fns";
import type { Task, TaskStatus } from "@/lib/types";

export function initials(name: string) {
  return name
    .replace(/^Pastor\s+/i, "")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function formatDue(date: string) {
  return format(parseISO(date), "EEE d MMM");
}

/** Compact label used in glass list rows: "Wed 12" */
export function formatDueShort(date: string) {
  return format(parseISO(date), "EEE d");
}

export function formatWhen(iso: string) {
  return format(parseISO(iso), "EEE d MMM · HH:mm");
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function fileExt(name: string) {
  return (name.split(".").pop() || "").toUpperCase().slice(0, 4);
}

export type DecoratedTask = Task & {
  late: boolean;
  daysLate: number;
  dateLabel: string;
  shortDateLabel: string;
  sortKey: number;
};

export function decorateTask(task: Task, today = new Date()): DecoratedTask {
  const due = parseISO(task.due_date);
  const daysLate = differenceInCalendarDays(today, due);
  const late = task.status !== "Done" && daysLate > 0;
  const dueMs = due.getTime();
  const lateLabel =
    daysLate === 1 ? "1 day late" : `${daysLate} days late`;

  return {
    ...task,
    late,
    daysLate,
    dateLabel: late ? lateLabel : formatDue(task.due_date),
    shortDateLabel: late ? lateLabel : formatDueShort(task.due_date),
    sortKey:
      task.status === "Done"
        ? 4e12 + dueMs
        : late
          ? -4e12 + dueMs
          : dueMs,
  };
}

export function sortTasks(tasks: Task[], today = new Date()) {
  return tasks
    .map((t) => decorateTask(t, today))
    .sort((a, b) => a.sortKey - b.sortKey);
}

export type TaskGroup = {
  key: "overdue" | "week" | "later" | "done";
  label: string;
  tasks: DecoratedTask[];
};

export function groupTasks(tasks: DecoratedTask[], today = new Date()): TaskGroup[] {
  const weekEnd = new Date(today);
  weekEnd.setHours(23, 59, 59, 999);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const overdue: DecoratedTask[] = [];
  const week: DecoratedTask[] = [];
  const later: DecoratedTask[] = [];
  const done: DecoratedTask[] = [];

  for (const t of tasks) {
    if (t.status === "Done") {
      done.push(t);
      continue;
    }
    if (t.late) {
      overdue.push(t);
      continue;
    }
    const due = parseISO(t.due_date);
    if (due <= weekEnd) week.push(t);
    else later.push(t);
  }

  const groups: TaskGroup[] = [];
  if (overdue.length) groups.push({ key: "overdue", label: "Overdue", tasks: overdue });
  if (week.length) groups.push({ key: "week", label: "This week", tasks: week });
  if (later.length) groups.push({ key: "later", label: "Later", tasks: later });
  if (done.length) groups.push({ key: "done", label: "Done", tasks: done });
  return groups;
}

export function isImageMime(mime: string | null, name: string) {
  if (mime?.startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp|heic)$/i.test(name);
}

export function statusDone(status: TaskStatus) {
  return status === "Done";
}
