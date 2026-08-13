"use client";

import { HijLogo } from "@/components/brand/hij-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { PersonAvatar } from "@/components/person-avatar";
import { useMe } from "@/components/cue/me-provider";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Person } from "@/lib/types";

function PersonPicker({ people }: { people: Person[] }) {
  const { setMeId } = useMe();

  return (
    <div className="glass-ambient relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-10 -left-36 size-[520px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.95),rgba(255,255,255,0)_70%)] blur-[40px] dark:opacity-20"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-28 -bottom-10 size-[380px] rounded-full bg-[radial-gradient(circle,rgba(90,97,114,0.35),rgba(90,97,114,0)_70%)] blur-[50px] dark:opacity-40"
      />

      <div className="absolute top-4 right-4 z-20 md:top-6 md:right-6">
        <ThemeToggle />
      </div>

      <div className="glass-panel relative z-10 w-full max-w-md px-6 py-8 md:px-8">
        <div className="mb-6 flex items-center gap-3">
          <HijLogo size={44} priority className="ring-1 ring-ink/10" />
          <div>
            <div className="text-[18px] font-medium tracking-[-0.02em] text-ink">
              HIJ Cue
            </div>
            <div className="font-mono text-[11px] tracking-[0.12em] text-ink-2 uppercase">
              White Clouds Media
            </div>
          </div>
        </div>

        <h1 className="text-[28px] font-medium tracking-[-0.02em] text-ink md:text-[32px]">
          Welcome to the team
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
          Choose your name below to see your tasks. You’re all set — no
          password needed.
        </p>

        <div className="mt-7">
          <Select onValueChange={(id) => setMeId(id)}>
            <SelectTrigger className="glass-surface h-12 w-full border-white/80 text-[15px] backdrop-blur-xl dark:border-white/10">
              <SelectValue placeholder="Select your name" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {people.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                    {p.is_admin ? " (admin)" : ""}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <p className="mt-8 text-center text-[13px] text-ink-2">
          Admin?{" "}
          <a
            href="/admin/login"
            className="font-medium text-ink underline underline-offset-4 transition-opacity hover:opacity-70"
          >
            Sign in here
          </a>
        </p>
      </div>
    </div>
  );
}

export function IdentityGate({
  people,
  children,
}: {
  people: Person[];
  children: React.ReactNode;
}) {
  const { me } = useMe();

  if (!me) {
    return <PersonPicker people={people} />;
  }

  return <>{children}</>;
}

export function MeAvatar({ onSwitch }: { onSwitch?: () => void }) {
  const { me, setMeId } = useMe();
  if (!me) return null;

  return (
    <button
      type="button"
      title="Switch person"
      onClick={() => {
        if (onSwitch) onSwitch();
        else setMeId(null);
      }}
      className="rounded-full transition-opacity hover:opacity-80"
    >
      <PersonAvatar person={me} size={32} />
    </button>
  );
}

export function SwitchPersonButton({ className }: { className?: string }) {
  const { setMeId } = useMe();
  return (
    <button
      type="button"
      className={cn(
        "text-[13px] text-ink-2 underline underline-offset-3 transition-opacity hover:opacity-70",
        className
      )}
      onClick={() => setMeId(null)}
    >
      Switch person
    </button>
  );
}
