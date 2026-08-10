import { AdminShell } from "@/components/admin/shell";
import { AdminTasksPanel } from "@/components/admin/tasks-panel";
import {
  getAttachments,
  getComments,
  getCurrentAdmin,
  getPeople,
  getTasks,
} from "@/lib/data";
import { redirect } from "next/navigation";
import type { Attachment, Comment } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");

  const [people, tasks] = await Promise.all([getPeople(), getTasks()]);
  const commentsByTask: Record<string, Comment[]> = {};
  const attachmentsByTask: Record<string, Attachment[]> = {};

  await Promise.all(
    tasks.map(async (task) => {
      const [comments, attachments] = await Promise.all([
        getComments(task.id),
        getAttachments(task.id),
      ]);
      commentsByTask[task.id] = comments;
      attachmentsByTask[task.id] = attachments;
    })
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
