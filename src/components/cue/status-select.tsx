"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { statusClasses, TASK_STATUSES, type TaskStatus } from "@/lib/types";

export function StatusSelect({
  value,
  onValueChange,
  disabled,
  className,
}: {
  value: TaskStatus;
  onValueChange: (status: TaskStatus) => void;
  disabled?: boolean;
  className?: string;
}) {
  const tone = statusClasses(value);

  return (
    <Select
      value={value}
      onValueChange={(v) => onValueChange(v as TaskStatus)}
      disabled={disabled}
    >
      <SelectTrigger
        className={cn(
          "h-10 w-full min-w-0 flex-1 gap-2 rounded-full border font-medium shadow-none dark:bg-transparent",
          tone.trigger,
          className
        )}
      >
        <span
          aria-hidden
          className={cn("size-2 shrink-0 rounded-full", tone.dot)}
        />
        <SelectValue placeholder="Status" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {TASK_STATUSES.map((s) => {
            const item = statusClasses(s);
            return (
              <SelectItem
                key={s}
                value={s}
                className={cn("gap-2 font-medium", item.item)}
              >
                {s}
              </SelectItem>
            );
          })}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
