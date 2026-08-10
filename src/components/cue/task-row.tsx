import { cn } from "@/lib/utils";
import type { DecoratedTask } from "@/lib/format";
import { statusDone } from "@/lib/format";

export function TaskRow({
  task,
  onClick,
  meta,
}: {
  task: DecoratedTask;
  onClick?: () => void;
  meta: string;
}) {
  const done = statusDone(task.status);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full min-h-11 items-center gap-3 border-b px-3.5 py-3 text-left transition-colors",
        task.late
          ? "border-white/28 bg-late text-white"
          : "border-structure bg-white hover:bg-page"
      )}
    >
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "text-[15px] font-medium leading-snug",
            done && !task.late && "text-ink-2 line-through",
            !done && !task.late && "text-ink"
          )}
        >
          {task.title}
        </div>
        <div
          className={cn(
            "mt-0.5 text-[13px]",
            task.late ? "text-white/78" : "text-ink-2"
          )}
        >
          {meta}
        </div>
      </div>
      <div
        className={cn(
          "shrink-0 font-mono text-[13px]",
          task.late ? "font-medium text-white" : "text-ink-2"
        )}
      >
        {task.dateLabel}
      </div>
    </button>
  );
}
