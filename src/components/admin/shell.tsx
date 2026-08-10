import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/data";
import { signOutAdmin } from "@/actions/cue";
import { Button } from "@/components/ui/button";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

export async function AdminShell({
  children,
  active,
}: {
  children: React.ReactNode;
  active: "tasks" | "team";
}) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");

  return (
    <div className="min-h-dvh bg-page">
      <header className="flex h-14 items-center gap-3.5 bg-ink px-5 text-white">
        <div className="grid size-7 place-items-center rounded-full border border-white/35 font-mono text-[10px]">
          HIJ
        </div>
        <div className="text-base font-medium">HIJ Cue</div>
        <nav className="ml-5 flex gap-1">
          <Link
            href="/admin"
            className={cn(
              "rounded-md px-2.5 py-1.5 text-sm",
              active === "tasks"
                ? "bg-white/12 text-white"
                : "text-white/62 hover:text-white"
            )}
          >
            All tasks
          </Link>
          <Link
            href="/admin/team"
            className={cn(
              "rounded-md px-2.5 py-1.5 text-sm",
              active === "team"
                ? "bg-white/12 text-white"
                : "text-white/62 hover:text-white"
            )}
          >
            Team
          </Link>
        </nav>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <div className="grid size-7 place-items-center rounded-full border border-white/35 font-mono text-[10.5px]">
            {initials(admin.name)}
          </div>
          <span className="hidden text-sm sm:inline">{admin.name}</span>
          <form action={signOutAdmin}>
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="text-white/80 hover:bg-white/10 hover:text-white"
            >
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1180px] px-4 py-6 sm:px-5">
        {children}
      </main>
    </div>
  );
}
