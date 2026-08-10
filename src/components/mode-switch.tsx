"use client";

import Link from "next/link";
import { ListIcon, UserRoundIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function ModeSwitch({
  active,
  className,
}: {
  active: "tasks" | "admin";
  className?: string;
}) {
  // On the team tasks view, only show Admin (no redundant Tasks tab).
  if (active === "tasks") {
    return (
      <Link
        href="/admin"
        title="Switch to admin"
        className={cn(
          "glass-segment inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[13px] whitespace-nowrap text-ink-2 transition-colors hover:text-ink sm:px-3.5",
          className
        )}
      >
        <UserRoundIcon className="size-3.5 shrink-0" strokeWidth={2} />
        <span className="sm:hidden">Admin</span>
        <span className="hidden sm:inline">Switch to admin</span>
      </Link>
    );
  }

  return (
    <div
      className={cn(
        "glass-segment inline-flex shrink-0 rounded-full p-0.5",
        className
      )}
      role="tablist"
      aria-label="App mode"
    >
      <Link
        href="/"
        role="tab"
        aria-selected={false}
        className="inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[13px] whitespace-nowrap text-ink-2 transition-all hover:text-ink"
      >
        <ListIcon className="size-3.5 shrink-0" strokeWidth={2} />
        Tasks
      </Link>
      <Link
        href="/admin"
        role="tab"
        aria-selected
        className="glass-pill-active inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium whitespace-nowrap transition-all"
      >
        <UserRoundIcon className="size-3.5 shrink-0" strokeWidth={2} />
        Admin
      </Link>
    </div>
  );
}
