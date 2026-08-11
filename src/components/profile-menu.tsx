"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { LogOutIcon, UserRoundIcon, ListIcon, SmileIcon, CalendarDaysIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AvatarPickerDialog } from "@/components/avatar-picker";
import { PersonAvatar } from "@/components/person-avatar";
import { useMe } from "@/components/cue/me-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Person } from "@/lib/types";
import { cn } from "@/lib/utils";

export function TeamProfileMenu({
  className,
  showName = false,
}: {
  className?: string;
  showName?: boolean;
}) {
  const { me, setMeId } = useMe();
  const [pickerOpen, setPickerOpen] = useState(false);
  if (!me) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "inline-flex items-center gap-2 rounded-full outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring/40",
            className
          )}
        >
          <PersonAvatar person={me} size={showName ? 28 : 32} />
          {showName ? (
            <span className="max-w-[120px] truncate text-[13.5px] text-ink">
              {me.name}
            </span>
          ) : null}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[200px]">
          <DropdownMenuLabel className="font-normal">
            <div className="text-[13px] font-medium text-foreground">{me.name}</div>
            <div className="font-mono text-[11px] text-muted-foreground">
              Team member
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer"
            onSelect={() => setPickerOpen(true)}
          >
            <SmileIcon className="size-4" />
            Set avatar
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/admin" className="cursor-pointer">
              <UserRoundIcon className="size-4" />
              Switch to admin
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setMeId(null)}
            className="cursor-pointer"
          >
            <LogOutIcon className="size-4" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AvatarPickerDialog
        person={me}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
      />
    </>
  );
}

export function AdminProfileMenu({
  person,
  role = "Admin",
  className,
}: {
  person: Person;
  role?: string;
  className?: string;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSignOut() {
    startTransition(async () => {
      const supabase = createClient();
      // Clear local session cookies immediately — no remote revoke wait.
      await supabase.auth.signOut({ scope: "local" });
      // Hard navigate so login paints without waiting on a server-action RSC round-trip.
      window.location.assign("/admin/login");
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={pending}
          className={cn(
            "inline-flex items-center gap-2 rounded-full outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring/40",
            className,
            pending && "opacity-60"
          )}
        >
          <PersonAvatar person={person} size={32} />
          <span className="hidden max-w-[140px] truncate text-[13px] text-ink md:inline">
            {person.name}
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[200px]">
          <DropdownMenuLabel className="font-normal">
            <div className="text-[13px] font-medium text-foreground">
              {person.name}
            </div>
            <div className="font-mono text-[11px] text-muted-foreground">
              {role} · Admin panel
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer"
            onSelect={() => setPickerOpen(true)}
          >
            <SmileIcon className="size-4" />
            Set avatar
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/" className="cursor-pointer">
              <ListIcon className="size-4" />
              Back to Tasks
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/admin/events" className="cursor-pointer">
              <CalendarDaysIcon className="size-4" />
              Manage events
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/admin/team" className="cursor-pointer">
              <UserRoundIcon className="size-4" />
              Manage team
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            className="cursor-pointer"
            disabled={pending}
            onSelect={(e) => {
              e.preventDefault();
              onSignOut();
            }}
          >
            <LogOutIcon className="size-4" />
            {pending ? "Signing out…" : "Sign out"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AvatarPickerDialog
        person={person}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
      />
    </>
  );
}
