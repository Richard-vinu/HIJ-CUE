import { getBannerMessage, getEvents, getPeople, getTaskExtras, getTasks } from "@/lib/data";
import { MeProvider } from "@/components/cue/me-provider";
import { IdentityGate } from "@/components/cue/identity-gate";
import { CueApp } from "@/components/cue/cue-app";
import { FloatingListen } from "@/components/floating-listen";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [people, tasks, bannerMessage, events] = await Promise.all([
    getPeople(),
    getTasks(),
    getBannerMessage(),
    getEvents(),
  ]);
  const { commentsByTask, attachmentsByTask } = await getTaskExtras(
    tasks.map((t) => t.id)
  );

  return (
    <MeProvider people={people}>
      <IdentityGate people={people}>
        <CueApp
          people={people}
          tasks={tasks}
          commentsByTask={commentsByTask}
          attachmentsByTask={attachmentsByTask}
          bannerMessage={bannerMessage}
          events={events}
        />
      </IdentityGate>
      <FloatingListen />
    </MeProvider>
  );
}
