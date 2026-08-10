"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { MoonIcon, SunIcon } from "lucide-react";
import { cn } from "@/lib/utils";

function subscribe() {
  return () => {};
}

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const isDark = (resolvedTheme ?? theme) === "dark";

  return (
    <button
      type="button"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
      disabled={!mounted}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "grid size-8 place-items-center rounded-full bg-ink/8 text-ink transition-colors hover:bg-ink/12 disabled:opacity-60",
        className
      )}
    >
      {mounted && isDark ? (
        <SunIcon className="size-[15px]" strokeWidth={1.75} />
      ) : (
        <MoonIcon className="size-[15px]" strokeWidth={1.75} />
      )}
    </button>
  );
}
