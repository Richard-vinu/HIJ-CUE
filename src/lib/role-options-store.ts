import { createServiceClient } from "@/lib/supabase/admin";
import { ROLE_SUGGESTIONS, normalizeRole } from "@/lib/roles";

const BUCKET = "task-files";
const PATH = "meta/role-options.json";

export type RoleOptionsFile = {
  roles: string[];
};

function uniqueSorted(roles: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of roles) {
    const clean = normalizeRole(raw).slice(0, 80);
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

async function downloadRoleOptions(): Promise<string[] | null> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.storage.from(BUCKET).download(PATH);
    if (error || !data) return null;
    const parsed = JSON.parse(await data.text()) as Partial<RoleOptionsFile>;
    if (!Array.isArray(parsed.roles)) return null;
    return uniqueSorted(parsed.roles.map(String));
  } catch {
    return null;
  }
}

async function uploadRoleOptions(
  roles: string[]
): Promise<{ error?: string }> {
  const supabase = createServiceClient();
  const body = JSON.stringify({
    roles: uniqueSorted(roles),
  } satisfies RoleOptionsFile);
  const { error } = await supabase.storage.from(BUCKET).upload(PATH, body, {
    contentType: "application/json",
    upsert: true,
  });
  if (error) return { error: error.message };
  return {};
}

/** Catalog of assignable roles (admin-managed). Seeds defaults on first load. */
export async function loadRoleOptions(): Promise<string[]> {
  const existing = await downloadRoleOptions();
  if (existing && existing.length > 0) return existing;
  const seeded = uniqueSorted([...ROLE_SUGGESTIONS]);
  await uploadRoleOptions(seeded);
  return seeded;
}

export async function addRoleOption(
  role: string
): Promise<{ error?: string; roles?: string[] }> {
  const clean = normalizeRole(role).slice(0, 80);
  if (!clean) return { error: "Enter a role name." };
  const current = await loadRoleOptions();
  if (current.some((r) => r.toLowerCase() === clean.toLowerCase())) {
    return { error: "That role is already in the list." };
  }
  const roles = uniqueSorted([...current, clean]);
  const result = await uploadRoleOptions(roles);
  if (result.error) return { error: result.error };
  return { roles };
}

export async function removeRoleOption(
  role: string
): Promise<{ error?: string; roles?: string[] }> {
  const clean = normalizeRole(role);
  if (!clean) return { error: "Missing role." };
  const current = await loadRoleOptions();
  const roles = current.filter((r) => r.toLowerCase() !== clean.toLowerCase());
  const result = await uploadRoleOptions(roles);
  if (result.error) return { error: result.error };
  return { roles };
}
