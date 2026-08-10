import { createServiceClient } from "@/lib/supabase/admin";
import type { AvatarFeatures } from "@/lib/avatar";
import type { Person } from "@/lib/types";

const BUCKET = "task-files";
const PATH = "meta/people-avatars.json";

export type StoredAvatar = {
  style: string;
  seed: string;
  features?: AvatarFeatures;
};

export type AvatarMap = Record<string, StoredAvatar>;

/** Shared avatar prefs (works without DB columns). */
export async function loadAvatarMap(): Promise<AvatarMap> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.storage.from(BUCKET).download(PATH);
    if (error || !data) return {};
    const parsed = JSON.parse(await data.text()) as AvatarMap;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

export async function savePersonAvatar(
  personId: string,
  style: string,
  seed: string,
  features?: AvatarFeatures | null
): Promise<{ error?: string }> {
  const supabase = createServiceClient();
  const map = await loadAvatarMap();
  map[personId] = {
    style,
    seed,
    ...(features ? { features } : {}),
  };
  const { error } = await supabase.storage.from(BUCKET).upload(
    PATH,
    JSON.stringify(map),
    { contentType: "application/json", upsert: true }
  );
  if (error) return { error: error.message };
  return {};
}

export function withAvatar<T extends Person | null | undefined>(
  person: T,
  map: AvatarMap
): T {
  if (!person) return person;
  const stored = map[person.id];
  if (!stored) return person;
  return {
    ...person,
    avatar_style: stored.style,
    avatar_seed: stored.seed,
    avatar_features: stored.features ?? null,
  };
}

export function withAvatars(people: Person[], map: AvatarMap): Person[] {
  return people.map((p) => withAvatar(p, map) as Person);
}
