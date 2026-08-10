import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { decorateTask, type DecoratedTask } from "@/lib/format";
import type { Task } from "@/lib/types";

export type CueEvent = {
  id: string;
  title: string;
  /** YYYY-MM-DD */
  date: string;
  /** Optional end date for multi-day events */
  endDate?: string | null;
};

export const DEFAULT_EVENTS: CueEvent[] = [
  {
    id: "evt-independence-2026",
    title: "Independence Day",
    date: "2026-08-15",
  },
  {
    id: "evt-anniversary-2026",
    title: "Anniversary service",
    date: "2026-08-16",
  },
  {
    id: "evt-baptism-2026",
    title: "Baptism service",
    date: "2026-08-30",
  },
  {
    id: "evt-youth-2026",
    title: "Youth camp",
    date: "2026-09-12",
    endDate: "2026-09-14",
  },
  {
    id: "evt-convention-2026",
    title: "Convention",
    date: "2026-10-15",
    endDate: "2026-10-18",
  },
];

export type EventStats = {
  total: number;
  done: number;
  late: number;
  people: number;
  tasks: DecoratedTask[];
};

/** Tasks for an event: due on the event date (or within multi-day range). */
export function tasksForEvent(event: CueEvent, tasks: Task[]): DecoratedTask[] {
  const start = event.date;
  const end = event.endDate || event.date;
  return tasks
    .filter((t) => t.due_date >= start && t.due_date <= end)
    .map((t) => decorateTask(t))
    .sort((a, b) => {
      if (a.late !== b.late) return a.late ? -1 : 1;
      if (a.status === "Done" && b.status !== "Done") return 1;
      if (b.status === "Done" && a.status !== "Done") return -1;
      return a.sortKey - b.sortKey;
    });
}

export function eventStats(event: CueEvent, tasks: Task[]): EventStats {
  const decorated = tasksForEvent(event, tasks);
  const done = decorated.filter((t) => t.status === "Done").length;
  const late = decorated.filter((t) => t.late).length;
  const people = new Set(
    decorated.map((t) => t.assignee_id).filter(Boolean)
  ).size;
  return {
    total: decorated.length,
    done,
    late,
    people,
    tasks: decorated,
  };
}

export function isEventPast(event: CueEvent, today = new Date()): boolean {
  const end = parseISO(event.endDate || event.date);
  return differenceInCalendarDays(today, end) > 0;
}

export function daysUntilEvent(event: CueEvent, today = new Date()): number {
  return differenceInCalendarDays(parseISO(event.date), today);
}

export function formatEventWhen(event: CueEvent): string {
  const start = parseISO(event.date);
  if (event.endDate && event.endDate !== event.date) {
    const end = parseISO(event.endDate);
    return `${format(start, "d MMM")} – ${format(end, "d MMM")}`;
  }
  return format(start, "EEE d MMM");
}

export function formatEventMonthDay(event: CueEvent): {
  month: string;
  day: string;
} {
  const d = parseISO(event.date);
  return {
    month: format(d, "MMM").toUpperCase(),
    day: format(d, "d"),
  };
}

export function eventSubtitle(
  event: CueEvent,
  stats: EventStats,
  today = new Date()
): string {
  if (isEventPast(event, today)) {
    return stats.total
      ? `${stats.done} / ${stats.total} done`
      : "Completed";
  }
  const days = daysUntilEvent(event, today);
  const when =
    days === 0
      ? "today"
      : days === 1
        ? "in 1 day"
        : days > 1
          ? `in ${days} days`
          : `${Math.abs(days)} days ago`;

  if (event.endDate && event.endDate !== event.date) {
    return `${format(parseISO(event.date), "d")} – ${format(parseISO(event.endDate), "d MMM")}${
      stats.total === 0 ? " · nothing assigned yet" : ` · ${when}`
    }`;
  }

  if (stats.late > 0) {
    return `${when} · ${stats.late} task${stats.late === 1 ? "" : "s"} late`;
  }
  if (stats.total === 0) return `${when} · nothing assigned yet`;
  return `${when} · on track`;
}
