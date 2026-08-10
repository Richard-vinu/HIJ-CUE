import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeftIcon, ShieldCheckIcon } from "lucide-react";
import { HijBrandLockup } from "@/components/brand/hij-logo";
import { AdminProfileMenu } from "@/components/profile-menu";
import { DesktopPreferredNotice } from "@/components/desktop-preferred-notice";
import { ThemeToggle } from "@/components/theme-toggle";
import { getCurrentAdmin } from "@/lib/data";
import { isSuperAdmin } from "@/lib/types";
import { cn } from "@/lib/utils";

export async function AdminShell({
  children,
  active,
}: {
  children: React.ReactNode;
  active: "tasks" | "team" | "events";
}) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");

  const superAdmin = isSuperAdmin(admin);

  const nav = [
    { href: "/admin", key: "tasks" as const, label: "Manage Tasks", short: "Tasks" },
    { href: "/admin/events", key: "events" as const, label: "Events", short: "Events" },
    { href: "/admin/team", key: "team" as const, label: "Team", short: "Team" },
  ];

  return (
    <div className="glass-ambient relative min-h-dvh overflow-x-hidden">
      <div
        aria-hidden
        className="pointer-events-none fixed -top-16 -left-40 size-[560px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.95),transparent_70%)] blur-[48px] dark:opacity-20"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed -right-32 bottom-0 size-[420px] rounded-full bg-[radial-gradient(circle,rgba(90,97,114,0.3),transparent_70%)] blur-[56px] dark:opacity-40"
      />

      <header className="glass-bar sticky top-0 z-40 border-b-[0.5px] border-ink/12">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-2.5 px-4 sm:gap-3 md:h-[56px] md:px-6">
          <HijBrandLockup markSize={40} priority className="min-w-0 shrink" />
          <span className="hidden shrink-0 rounded-full bg-[#101729] px-2.5 py-1 font-mono text-[10px] tracking-[0.1em] text-white uppercase sm:inline dark:bg-white dark:text-[#101729]">
            Admin panel
          </span>

          <nav className="glass-segment ml-1 hidden shrink-0 rounded-[12px] p-0.5 md:flex">
            {nav.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className={cn(
                  "rounded-[10px] px-3.5 py-1.5 text-[13px] transition-all",
                  active === item.key
                    ? "glass-pill-active font-medium"
                    : "text-ink-2 hover:text-ink"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex-1" />

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 md:gap-3">
            <Link
              href="/"
              className="hidden h-9 items-center gap-1.5 rounded-[10px] px-2.5 text-[13px] text-ink-2 transition-colors hover:bg-ink/6 hover:text-ink sm:inline-flex"
            >
              <ArrowLeftIcon className="size-3.5" strokeWidth={2} />
              Back to Tasks
            </Link>
            <ThemeToggle />
            <AdminProfileMenu
              person={admin}
              role={superAdmin ? "Super admin" : "Admin"}
            />
          </div>
        </div>

        <div className="border-t-[0.5px] border-ink/10 bg-[#101729]/[0.04] px-4 py-2 md:px-6 dark:bg-white/[0.06]">
          <div className="mx-auto flex max-w-[1400px] items-center gap-2">
            <ShieldCheckIcon
              className="size-3.5 shrink-0 text-ink"
              strokeWidth={2}
            />
            <p className="min-w-0 text-[12.5px] text-ink md:text-[13px]">
              <span className="font-medium">You are on the admin panel.</span>
              <span className="text-ink-2">
                {" "}
                Create tasks, manage events, and run the team here.
                {superAdmin ? " You are the super admin." : ""}
              </span>
            </p>
          </div>
        </div>

        <div className="border-t-[0.5px] border-ink/8 px-4 pb-2.5 md:hidden">
          <div className="glass-segment mt-2.5 flex rounded-[12px] p-0.5">
            {nav.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className={cn(
                  "flex h-9 flex-1 items-center justify-center rounded-[10px] px-1 text-center text-[12px] sm:text-[13px]",
                  active === item.key
                    ? "glass-pill-active font-medium"
                    : "text-ink-2"
                )}
              >
                {item.short}
              </Link>
            ))}
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-[1400px] px-4 py-4 pb-28 md:px-6 md:py-6 lg:pb-8">
        {children}
      </main>
      <DesktopPreferredNotice />
    </div>
  );
}
