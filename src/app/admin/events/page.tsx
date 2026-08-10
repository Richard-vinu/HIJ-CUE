import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/shell";
import { EventsPanel } from "@/components/cue/events-panel";
import { getCurrentAdmin, getEvents, getTasks } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AdminEventsPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");

  const [events, tasks] = await Promise.all([getEvents(), getTasks()]);

  return (
    <AdminShell active="events">
      <div className="pb-24 lg:pb-0">
        <EventsPanel
          events={events}
          tasks={tasks}
          canManage
          defaultView="calendar"
        />
      </div>
    </AdminShell>
  );
}
