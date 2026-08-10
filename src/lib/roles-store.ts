import { createServiceClient } from "@/lib/supabase/admin";
import { DEFAULT_ROLES_BY_SLUG, normalizeRole } from "@/lib/roles";
import type { Person } from "@/lib/types";

const BUCKET = "task-files";
const PATH = "meta/people-roles.json";

export type RoleMap = Record<string, string>;

async function downloadRoleMap(): Promise<RoleMap | null> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.storage.from(BUCKET).download(PATH);
    if (error || !data) return null;
    const parsed = JSON.parse(await data.text()) as RoleMap;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function uploadRoleMap(map: RoleMap): Promise<{ error?: string }> {
  const supabase = createServiceClient();
  const { error } = await supabase.storage.from(BUCKET).upload(
    PATH,
    JSON.stringify(map),
    { contentType: "application/json", upsert: true }
  );
  if (error) return { error: error.message };
  return {};
}

/**
 * Shared role prefs (works without a DB column).
 * When people are provided, missing seeded slugs get default mockup roles once.
 */
export async function loadRoleMap(people?: Person[]): Promise<RoleMap> {
  const existing = (await downloadRoleMap()) ?? {};
  if (!people?.length) return existing;

  let changed = false;
  const map = { ...existing };
  for (const person of people) {
    if (map[person.id]) continue;
    const role = DEFAULT_ROLES_BY_SLUG[person.slug];
    if (!role) continue;
    map[person.id] = role;
    changed = true;
  }
  if (changed) await uploadRoleMap(map);
  return map;
}

export async function savePersonRole(
  personId: string,
  role: string
): Promise<{ error?: string }> {
  if (!personId) return { error: "Missing person." };
  const clean = normalizeRole(role).slice(0, 80);
  const map = (await downloadRoleMap()) ?? {};
  if (clean) map[personId] = clean;
  else delete map[personId];
  return uploadRoleMap(map);
}

export function withRole<T extends Person | null | undefined>(
  person: T,
  map: RoleMap
): T {
  if (!person) return person;
  const fromMap = map[person.id];
  const fromDb = person.role;
  const role = normalizeRole(fromMap ?? fromDb) || null;
  return { ...person, role };
}

export function withRoles(people: Person[], map: RoleMap): Person[] {
  return people.map((p) => withRole(p, map) as Person);
}
