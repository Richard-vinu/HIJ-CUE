import { createServiceClient } from "@/lib/supabase/admin";
import { DEFAULT_EVENTS, type CueEvent } from "@/lib/events";

const BUCKET = "task-files";
const PATH = "meta/site-events.json";

export type EventsFile = {
  events: CueEvent[];
};

function normalize(events: CueEvent[]): CueEvent[] {
  return [...events].sort((a, b) => a.date.localeCompare(b.date));
}

export async function loadEvents(): Promise<CueEvent[]> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.storage.from(BUCKET).download(PATH);
    if (error || !data) {
      await saveEvents(DEFAULT_EVENTS);
      return normalize(DEFAULT_EVENTS);
    }
    const parsed = JSON.parse(await data.text()) as Partial<EventsFile>;
    const list = Array.isArray(parsed.events) ? parsed.events : [];
    if (list.length === 0) {
      await saveEvents(DEFAULT_EVENTS);
      return normalize(DEFAULT_EVENTS);
    }
    return normalize(
      list.filter(
        (e) =>
          e &&
          typeof e.id === "string" &&
          typeof e.title === "string" &&
          typeof e.date === "string"
      )
    );
  } catch {
    return normalize(DEFAULT_EVENTS);
  }
}

export async function saveEvents(
  events: CueEvent[]
): Promise<{ error?: string }> {
  const supabase = createServiceClient();
  const body = JSON.stringify({
    events: normalize(events),
  } satisfies EventsFile);
  const { error } = await supabase.storage.from(BUCKET).upload(PATH, body, {
    contentType: "application/json",
    upsert: true,
  });
  if (error) return { error: error.message };
  return {};
}

export async function upsertEvent(
  event: CueEvent
): Promise<{ error?: string }> {
  const events = await loadEvents();
  const idx = events.findIndex((e) => e.id === event.id);
  if (idx >= 0) events[idx] = event;
  else events.push(event);
  return saveEvents(events);
}

export async function deleteEventById(
  id: string
): Promise<{ error?: string }> {
  const events = await loadEvents();
  return saveEvents(events.filter((e) => e.id !== id));
}
