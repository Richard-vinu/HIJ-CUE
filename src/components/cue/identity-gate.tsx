"use client";

import { useMe } from "@/components/cue/me-provider";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Person } from "@/lib/types";

function BrandPanel() {
  return (
    <div className="relative flex min-h-[42vh] flex-col justify-between overflow-hidden bg-ink px-8 py-10 text-white md:min-h-dvh md:px-14 md:py-14 lg:px-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 18% 22%, #ffffff 0.6px, transparent 0.7px), radial-gradient(circle at 78% 68%, #ffffff 0.6px, transparent 0.7px)",
          backgroundSize: "28px 28px",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -bottom-28 size-[420px] rounded-full bg-white/[0.06] blur-2xl"
      />

      <div className="relative">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-full border border-white/30 font-mono text-[11px] tracking-wide">
            HIJ
          </div>
          <div className="font-mono text-[11px] tracking-[0.18em] text-white/55 uppercase">
            Hope in Jesus
          </div>
        </div>
      </div>

      <div className="relative max-w-lg py-10 md:py-0">
        <p className="font-mono text-[12px] tracking-[0.16em] text-white/50 uppercase">
          Media · Worship · Production
        </p>
        <h1 className="mt-4 text-[42px] leading-[1.05] font-medium tracking-[-0.03em] md:text-[56px] lg:text-[64px]">
          Cue
        </h1>
        <p className="mt-4 max-w-[34ch] text-[16px] leading-relaxed text-white/70 md:text-[17px]">
          Know what needs doing, who owns it, and when it is due — before Sunday
          arrives.
        </p>
      </div>

      <p className="relative font-mono text-[11px] text-white/35">
        Internal team · HIJ Apostolic Church
      </p>
    </div>
  );
}

function PersonPicker({ people }: { people: Person[] }) {
  const { setMeId } = useMe();

  return (
    <div className="flex min-h-[58vh] flex-col justify-center bg-page px-6 py-10 md:min-h-dvh md:px-12 lg:px-16">
      <div className="mx-auto w-full max-w-md md:mx-0 md:max-w-lg">
        <h2 className="text-[28px] leading-tight font-medium tracking-[-0.02em] text-ink md:text-[34px]">
          Who are you?
        </h2>
        <p className="mt-2 max-w-[40ch] text-[15px] leading-relaxed text-ink-2">
          Pick your name to open your tasks. No password needed for the team
          view.
        </p>

        <div className="mt-8">
          <Select onValueChange={(id) => setMeId(id)}>
            <SelectTrigger className="h-12 w-full bg-white text-[15px]">
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

        <p className="mt-10 text-[13px] text-ink-2">
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
    return (
      <div className="grid min-h-dvh md:grid-cols-2">
        <BrandPanel />
        <PersonPicker people={people} />
      </div>
    );
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
      className="grid size-8 place-items-center rounded-full border border-white/35 font-mono text-[11px] font-medium text-white transition-colors hover:bg-white/10"
    >
      {initials(me.name)}
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
