"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { removeEvent, saveEvent } from "@/actions/cue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { PersonAvatar } from "@/components/person-avatar";
import {
  daysUntilEvent,
  eventStats,
  eventSubtitle,
  formatEventMonthDay,
  formatEventWhen,
  isEventPast,
  type CueEvent,
} from "@/lib/events";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/types";

function ProgressBar({
  done,
  total,
  late,
}: {
  done: number;
  total: number;
  late: number;
}) {
  const pctDone = total ? (done / total) * 100 : 0;
  const pctLate = total ? (late / total) * 100 : 0;
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <div className="flex h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-ink/10 dark:bg-white/10">
        {pctLate > 0 ? (
          <div className="h-full bg-late" style={{ width: `${pctLate}%` }} />
        ) : null}
        {pctDone > 0 ? (
          <div
            className="h-full bg-ink dark:bg-white"
            style={{ width: `${pctDone}%` }}
          />
        ) : null}
      </div>
      <span className="shrink-0 font-mono text-[12px] tabular-nums text-ink-2">
        {done} / {total}
      </span>
    </div>
  );
}

export function EventsPanel({
  events,
  tasks,
  canManage,
  onOpenTask,
  defaultView = "list",
}: {
  events: CueEvent[];
  tasks: Task[];
  canManage: boolean;
  onOpenTask?: (taskId: string) => void;
  /** Calendar is admin-only; non-admins always get list. */
  defaultView?: "list" | "calendar";
}) {
  const router = useRouter();
  const [view, setView] = useState<"list" | "calendar">(
    canManage && defaultView === "calendar" ? "calendar" : "list"
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    () => events.find((e) => !isEventPast(e))?.id ?? events[0]?.id ?? null
  );
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [draftTitle, setDraftTitle] = useState("");
  const [draftDate, setDraftDate] = useState("");
  const [draftEnd, setDraftEnd] = useState("");
  const detailRef = useRef<HTMLDivElement | null>(null);
  const skipScrollRef = useRef(true);

  const upcoming = useMemo(
    () => events.filter((e) => !isEventPast(e)),
    [events]
  );
  const doneEvents = useMemo(
    () => events.filter((e) => isEventPast(e)),
    [events]
  );

  const selected =
    events.find((e) => e.id === selectedId) ??
    upcoming[0] ??
    events[0] ??
    null;
  const selectedStats = selected ? eventStats(selected, tasks) : null;

  function selectEvent(id: string) {
    skipScrollRef.current = false;
    setSelectedId(id);
    setView("list");
  }

  useEffect(() => {
    if (skipScrollRef.current) return;
    if (!selectedId || !detailRef.current) return;
    // Only needed on the stacked mobile layout
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches) {
      return;
    }
    const node = detailRef.current;
    const frame = requestAnimationFrame(() => {
      node.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedId]);

  function openCreate() {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    setDraftTitle("");
    setDraftDate(d.toISOString().slice(0, 10));
    setDraftEnd("");
    setCreateOpen(true);
  }

  function openEdit() {
    if (!selected) return;
    setDraftTitle(selected.title);
    setDraftDate(selected.date);
    setDraftEnd(selected.endDate || "");
    setEditOpen(true);
  }

  function submitEvent(existingId?: string) {
    startTransition(async () => {
      const res = await saveEvent({
        id: existingId,
        title: draftTitle,
        date: draftDate,
        endDate: draftEnd || null,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(existingId ? "Event updated" : "Event created");
      setCreateOpen(false);
      setEditOpen(false);
      if (res.id) setSelectedId(res.id);
      router.refresh();
    });
  }

  function onDelete() {
    if (!selected) return;
    if (!confirm(`Delete “${selected.title}”?`)) return;
    startTransition(async () => {
      const res = await removeEvent(selected.id);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Event deleted");
        setSelectedId(null);
        router.refresh();
      }
    });
  }

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  function eventsOnDay(day: Date) {
    const key = format(day, "yyyy-MM-dd");
    return events.filter((e) => {
      const end = e.endDate || e.date;
      return key >= e.date && key <= end;
    });
  }

  const eventForm = (mode: "create" | "edit") => (
    <FieldGroup>
      <Field>
        <FieldLabel>Title</FieldLabel>
        <Input
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          className="glass-surface"
          placeholder="Anniversary service"
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel>Date</FieldLabel>
          <Input
            type="date"
            value={draftDate}
            onChange={(e) => setDraftDate(e.target.value)}
            className="glass-surface font-mono"
          />
        </Field>
        <Field>
          <FieldLabel>End date (optional)</FieldLabel>
          <Input
            type="date"
            value={draftEnd}
            onChange={(e) => setDraftEnd(e.target.value)}
            className="glass-surface font-mono"
          />
        </Field>
      </div>
      <DialogFooter>
        <Button
          type="button"
          variant="ghost"
          onClick={() =>
            mode === "create" ? setCreateOpen(false) : setEditOpen(false)
          }
        >
          Cancel
        </Button>
        <Button
          type="button"
          className="rounded-[12px]"
          disabled={pending}
          onClick={() =>
            submitEvent(mode === "edit" ? selected?.id : undefined)
          }
        >
          {mode === "create" ? "Create event" : "Save event"}
        </Button>
      </DialogFooter>
    </FieldGroup>
  );

  function EventCard({
    event,
    active,
    onClick,
  }: {
    event: CueEvent;
    active?: boolean;
    onClick: () => void;
  }) {
    const stats = eventStats(event, tasks);
    const { month: mo, day } = formatEventMonthDay(event);
    const late = stats.late > 0 && !isEventPast(event);
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "w-full rounded-[16px] px-3.5 py-3 text-left transition-colors",
          active
            ? late
              ? "bg-late/15 ring-1 ring-late/30"
              : "bg-white/70 ring-1 ring-ink/10 dark:bg-white/[0.1]"
            : "hover:bg-white/45 dark:hover:bg-white/[0.05]",
          late && !active && "bg-late/[0.06]"
        )}
      >
        <div className="flex gap-3">
          <div className="w-11 shrink-0 text-center">
            <div className="font-mono text-[10px] tracking-[0.08em] text-ink-2">
              {mo}
            </div>
            <div className="text-[22px] leading-none font-medium tracking-[-0.02em] text-ink">
              {day}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-medium text-ink">
              {event.title}
            </div>
            <div
              className={cn(
                "mt-0.5 text-[12.5px]",
                late ? "text-late" : "text-ink-2"
              )}
            >
              {eventSubtitle(event, stats)}
            </div>
            <div className="mt-2.5">
              <ProgressBar
                done={stats.done}
                total={stats.total}
                late={stats.late}
              />
            </div>
          </div>
        </div>
      </button>
    );
  }

  const detail = selected && selectedStats && (
    <div className="min-w-0">
      <div
        className={cn(
          "font-mono text-[11px] tracking-[0.08em] uppercase",
          selectedStats.late > 0 && !isEventPast(selected)
            ? "text-late"
            : "text-ink-2"
        )}
      >
        {formatEventWhen(selected).toUpperCase()}
        {!isEventPast(selected) ? (
          <>
            {" · "}
            {daysUntilEvent(selected) === 0
              ? "TODAY"
              : `IN ${daysUntilEvent(selected)} DAY${
                  daysUntilEvent(selected) === 1 ? "" : "S"
                }`}
          </>
        ) : null}
      </div>
      <h2 className="mt-1.5 text-[26px] font-medium tracking-[-0.02em] text-ink md:text-[30px]">
        {selected.title}
      </h2>
      <p className="mt-1.5 text-[13.5px] text-ink-2">
        {selectedStats.total} task{selectedStats.total === 1 ? "" : "s"}
        {selectedStats.total
          ? ` · ${selectedStats.done} done${
              selectedStats.late ? ` · ${selectedStats.late} late` : ""
            } · ${selectedStats.people} people involved`
          : " · nothing assigned yet — set task due dates to this event day"}
      </p>

      {canManage ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-[12px]"
            onClick={openEdit}
          >
            Edit event
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-[12px] text-late"
            disabled={pending}
            onClick={onDelete}
          >
            Delete
          </Button>
        </div>
      ) : null}

      <div className="mt-5 overflow-hidden rounded-[18px]">
        {selectedStats.tasks.length === 0 ? (
          <div className="glass-panel px-5 py-12 text-center">
            <p className="text-[15px] font-medium text-ink">No tasks yet</p>
            <p className="mt-1 text-[13px] text-ink-2">
              Tasks with due date on this event day show up here.
            </p>
          </div>
        ) : (
          <div className="glass-panel overflow-hidden">
            {selectedStats.tasks.map((t, i) => {
              const rowClass = cn(
                "flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors",
                t.late
                  ? "bg-late/10 hover:bg-late/[0.14]"
                  : "hover:bg-white/40 dark:hover:bg-white/[0.04]",
                i < selectedStats.tasks.length - 1 &&
                  "border-b-[0.5px] border-ink/10"
              );
              const body = (
                <>
                  <div className="min-w-0 flex-1">
                    <div
                      className={cn(
                        "truncate text-[15px] font-medium text-ink",
                        t.status === "Done" && "text-ink-2 line-through"
                      )}
                    >
                      {t.title}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[12.5px] text-ink-2">
                      <PersonAvatar
                        person={t.assignee ?? { name: "?" }}
                        size={18}
                      />
                      <span className="truncate">
                        {t.assignee?.name ?? "Unassigned"}
                      </span>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 font-mono text-[12.5px] tabular-nums",
                      t.late ? "font-medium text-late" : "text-ink-2"
                    )}
                  >
                    {t.shortDateLabel}
                  </span>
                </>
              );
              if (onOpenTask) {
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onOpenTask(t.id)}
                    className={rowClass}
                  >
                    {body}
                  </button>
                );
              }
              return (
                <div key={t.id} className={rowClass}>
                  {body}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-w-0">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-medium tracking-[-0.02em] text-ink md:text-[26px]">
            Events
          </h1>
          <p className="mt-1 font-mono text-[12px] text-ink-2">
            {upcoming.length} upcoming · {doneEvents.length} done
            {!canManage
              ? " · admins manage events in the admin panel"
              : " · create, edit, delete, calendar"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManage ? (
            <div className="glass-segment flex rounded-[12px] p-0.5">
              {(
                [
                  ["list", "List"],
                  ["calendar", "Calendar"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setView(key)}
                  className={cn(
                    "h-9 rounded-[10px] px-3 text-[13px] transition-all",
                    view === key
                      ? "glass-pill-active font-medium"
                      : "text-ink-2"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
          {canManage ? (
            <button
              type="button"
              onClick={openCreate}
              className="glass-cta inline-flex h-10 items-center gap-1.5 rounded-[12px] px-3.5 text-[13px] font-medium"
            >
              <PlusIcon className="size-4" />
              New event
            </button>
          ) : null}
        </div>
      </div>

      {view === "calendar" && canManage ? (
        <div className="glass-panel overflow-hidden p-4 md:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="text-[18px] font-medium tracking-[-0.02em] text-ink">
              {format(month, "MMMM yyyy")}
            </div>
            <div className="flex gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-9 rounded-[10px]"
                onClick={() => setMonth((m) => addMonths(m, -1))}
              >
                <ChevronLeftIcon className="size-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-9 rounded-[10px]"
                onClick={() => setMonth((m) => addMonths(m, 1))}
              >
                <ChevronRightIcon className="size-4" />
              </Button>
            </div>
          </div>
          <div className="mb-2 grid grid-cols-7 gap-1">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div
                key={d}
                className="px-1 py-1 font-mono text-[10px] tracking-[0.06em] text-ink-2 uppercase"
              >
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day) => {
              const dayEvents = eventsOnDay(day);
              const inMonth = isSameMonth(day, month);
              const today = isSameDay(day, new Date());
              const hasLate = dayEvents.some(
                (e) => eventStats(e, tasks).late > 0 && !isEventPast(e)
              );
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  disabled={!inMonth}
                  onClick={() => {
                    if (dayEvents[0]) {
                      selectEvent(dayEvents[0].id);
                    }
                  }}
                  className={cn(
                    "min-h-[72px] rounded-[12px] p-1.5 text-left transition-colors md:min-h-[88px]",
                    !inMonth && "opacity-30",
                    inMonth && "hover:bg-ink/5 dark:hover:bg-white/[0.06]",
                    today && "ring-1 ring-ink/30",
                    hasLate && "bg-late/15"
                  )}
                >
                  <div className="font-mono text-[11px] text-ink-2">
                    {format(day, "d")}
                  </div>
                  <div className="mt-1 space-y-0.5">
                    {dayEvents.slice(0, 2).map((e) => (
                      <div
                        key={e.id}
                        className="truncate text-[11px] font-medium text-ink"
                      >
                        {e.title}
                      </div>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
          <p className="mt-3 hidden text-[12px] text-ink-2 md:block">
            Tip: calendar is best on desktop — on phones, use the list view.
          </p>
        </div>
      ) : (
        <>
          {/* Mobile list — detail opens under the tapped card, then scrolls into view */}
          <div className="space-y-2.5 lg:hidden">
            {upcoming.map((e) => (
              <div key={e.id} className="space-y-2">
                <div className="glass-panel overflow-hidden p-1">
                  <EventCard
                    event={e}
                    active={e.id === selected?.id}
                    onClick={() => selectEvent(e.id)}
                  />
                </div>
                {selected?.id === e.id && selectedStats ? (
                  <div
                    ref={detailRef}
                    className="scroll-mt-28 rounded-[18px] pb-4"
                  >
                    {detail}
                  </div>
                ) : null}
              </div>
            ))}
            {doneEvents.length ? (
              <div className="pt-4">
                <div className="mb-2 px-1 font-mono text-[11px] tracking-[0.08em] text-ink-2 uppercase">
                  Done
                </div>
                <div className="space-y-2">
                  {doneEvents.map((e) => (
                    <div key={e.id} className="space-y-2">
                      <div className="glass-panel overflow-hidden p-1">
                        <EventCard
                          event={e}
                          active={e.id === selected?.id}
                          onClick={() => selectEvent(e.id)}
                        />
                      </div>
                      {selected?.id === e.id && selectedStats ? (
                        <div
                          ref={detailRef}
                          className="scroll-mt-28 rounded-[18px] pb-4"
                        >
                          {detail}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {/* Desktop split */}
          <div className="hidden gap-5 lg:grid lg:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)] lg:items-start">
            <aside className="min-w-0 space-y-4">
              <div>
                <div className="mb-2 px-1 font-mono text-[11px] tracking-[0.08em] text-ink-2 uppercase">
                  Next up
                </div>
                <div className="glass-panel space-y-0.5 overflow-hidden p-1.5">
                  {upcoming.length === 0 ? (
                    <p className="px-3 py-6 text-center text-[13px] text-ink-2">
                      No upcoming events
                    </p>
                  ) : (
                    upcoming.map((e) => (
                      <EventCard
                        key={e.id}
                        event={e}
                        active={e.id === selected?.id}
                        onClick={() => selectEvent(e.id)}
                      />
                    ))
                  )}
                </div>
              </div>
              {doneEvents.length ? (
                <div>
                  <div className="mb-2 px-1 font-mono text-[11px] tracking-[0.08em] text-ink-2 uppercase">
                    Done
                  </div>
                  <div className="glass-panel space-y-0.5 overflow-hidden p-1.5">
                    {doneEvents.map((e) => (
                      <EventCard
                        key={e.id}
                        event={e}
                        active={e.id === selected?.id}
                        onClick={() => selectEvent(e.id)}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </aside>
            <div className="min-w-0">{detail}</div>
          </div>
        </>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:rounded-[22px]">
          <DialogHeader>
            <DialogTitle>New event</DialogTitle>
          </DialogHeader>
          {eventForm("create")}
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:rounded-[22px]">
          <DialogHeader>
            <DialogTitle>Edit event</DialogTitle>
          </DialogHeader>
          {eventForm("edit")}
        </DialogContent>
      </Dialog>

      {canManage ? (
        <div className="glass-bar fixed right-0 bottom-0 left-0 z-30 border-t-[0.5px] border-ink/10 px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] lg:hidden">
          <button
            type="button"
            onClick={openCreate}
            className="glass-cta flex h-12 w-full items-center justify-center gap-2 rounded-[14px] text-[16px] font-medium tracking-[-0.01em]"
          >
            <PlusIcon className="size-[18px]" />
            New event
          </button>
        </div>
      ) : null}
    </div>
  );
}
