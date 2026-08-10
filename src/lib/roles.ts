/** Free-text team roles + category grouping (mockups 5a / 5b). */

export type RoleGroupId = "worship" | "media" | "production" | "other" | "none";

export type RoleGroup = {
  id: RoleGroupId;
  label: string;
};

export const ROLE_GROUPS: RoleGroup[] = [
  { id: "worship", label: "Worship" },
  { id: "media", label: "Media" },
  { id: "production", label: "Production" },
  { id: "other", label: "Other" },
  { id: "none", label: "No role set" },
];

/** Seed roles for first-time catalog / people-role defaults. */
export const ROLE_SUGGESTIONS = [
  "Worship lead",
  "Keys",
  "Vocals",
  "Drums",
  "Bass",
  "Guitar",
  "Media lead",
  "ProPresenter",
  "Camera",
  "Graphics",
  "Light engineer",
  "Sound engineer",
  "Stage",
  "Pastor",
  "Coordinator",
] as const;

const GROUP_MATCHERS: {
  id: Exclude<RoleGroupId, "none" | "other">;
  needles: string[];
}[] = [
  {
    id: "worship",
    needles: [
      "worship",
      "keys",
      "vocal",
      "drum",
      "bass",
      "guitar",
      "piano",
      "choir",
    ],
  },
  {
    id: "media",
    needles: [
      "media",
      "propresenter",
      "camera",
      "video",
      "graphics",
      "slides",
      "livestream",
      "stream",
    ],
  },
  {
    id: "production",
    needles: [
      "light",
      "sound",
      "audio",
      "stage",
      "production",
      "engineer",
      "tech",
    ],
  },
];

export function normalizeRole(role: string | null | undefined): string {
  return (role ?? "").trim().replace(/\s+/g, " ");
}

export function roleGroupFor(role: string | null | undefined): RoleGroupId {
  const clean = normalizeRole(role).toLowerCase();
  if (!clean) return "none";
  for (const group of GROUP_MATCHERS) {
    if (group.needles.some((n) => clean.includes(n))) return group.id;
  }
  return "other";
}

export function roleGroupLabel(id: RoleGroupId): string {
  return ROLE_GROUPS.find((g) => g.id === id)?.label ?? "Team";
}

/** Seed roles aligned with design mockups (by person slug). */
export const DEFAULT_ROLES_BY_SLUG: Record<string, string> = {
  prasthuthi: "Worship lead",
  jayashree: "Keys",
  baji: "ProPresenter",
  jeswin: "Camera",
  elvin: "Light engineer",
  nikhil: "Sound engineer",
  anish: "Pastor",
  sushma: "Coordinator",
  deepak: "Media lead",
};
