import { getAttachments, getComments, getPeople, getTasks } from "@/lib/data";
import { MeProvider } from "@/components/cue/me-provider";
import { IdentityGate } from "@/components/cue/identity-gate";
import { CueApp } from "@/components/cue/cue-app";
import type { Attachment, Comment } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
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
    <MeProvider people={people}>
      <IdentityGate people={people}>
        <CueApp
          people={people}
          tasks={tasks}
          commentsByTask={commentsByTask}
          attachmentsByTask={attachmentsByTask}
        />
      </IdentityGate>
    </MeProvider>
  );
}
