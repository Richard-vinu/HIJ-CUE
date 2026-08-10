import { AdminShell } from "@/components/admin/shell";
import { AdminTasksPanel } from "@/components/admin/tasks-panel";
import {
  getCurrentAdmin,
  getPeople,
  getTaskExtras,
  getTasks,
} from "@/lib/data";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");

  const [people, tasks] = await Promise.all([getPeople(), getTasks()]);
  const { commentsByTask, attachmentsByTask } = await getTaskExtras(
    tasks.map((t) => t.id)
  );

  return (
    <AdminShell active="tasks">
      <AdminTasksPanel
        people={people}
        tasks={tasks}
        commentsByTask={commentsByTask}
        attachmentsByTask={attachmentsByTask}
        adminId={admin.id}
      />
    </AdminShell>
  );
}
