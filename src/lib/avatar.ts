/** DiceBear — Toon Head only: https://www.dicebear.com/styles/toon-head/ */

export const AVATAR_STYLE = "toon-head" as const;

export type AvatarStyleId = typeof AVATAR_STYLE;

export const DEFAULT_AVATAR_STYLE: AvatarStyleId = AVATAR_STYLE;

export const HAIR_VARIANTS = [
  "bun",
  "sideComed",
  "spiky",
  "undercut",
] as const;

export const EYES_VARIANTS = [
  "bow",
  "happy",
  "humble",
  "wide",
  "wink",
] as const;

export const MOUTH_VARIANTS = [
  "agape",
  "angry",
  "laugh",
  "sad",
  "smile",
] as const;

export type HairVariant = (typeof HAIR_VARIANTS)[number];
export type EyesVariant = (typeof EYES_VARIANTS)[number];
export type MouthVariant = (typeof MOUTH_VARIANTS)[number];

/** Face feature locks for a reproducible Toon Head look */
export type AvatarFeatures = {
  hairVariant: HairVariant;
  eyesVariant: EyesVariant;
  mouthVariant: MouthVariant;
  eyebrowsVariant?: "angry" | "happy" | "neutral" | "raised" | "sad";
};

export type AvatarChoice = AvatarFeatures & {
  seed: string;
};

/** How many looks to show in the picker at once */
export const AVATAR_PICKER_COUNT = 6;

/** Soft single backgrounds — multi-value backgroundColor returns 400 for toon-head */
const BACKGROUNDS = ["e8eaef", "dde1e8", "d5dae3", "eceef2", "e4e8f0"] as const;

export function isAvatarStyle(value: string): value is AvatarStyleId {
  return value === AVATAR_STYLE;
}

export type AvatarPerson = {
  name: string;
  slug?: string | null;
  avatar_style?: string | null;
  avatar_seed?: string | null;
  avatar_features?: {
    hairVariant: string;
    eyesVariant: string;
    mouthVariant: string;
    eyebrowsVariant?: string;
  } | null;
};

export function resolveAvatarStyle(): AvatarStyleId {
  return AVATAR_STYLE;
}

export function resolveAvatarSeed(person: AvatarPerson): string {
  const seed = person.avatar_seed?.trim();
  if (seed) return seed;
  return person.slug?.trim() || person.name.trim() || "guest";
}

export function resolveAvatarFeatures(
  person: AvatarPerson
): AvatarFeatures | null {
  const f = person.avatar_features;
  if (
    f &&
    HAIR_VARIANTS.includes(f.hairVariant as HairVariant) &&
    EYES_VARIANTS.includes(f.eyesVariant as EyesVariant) &&
    MOUTH_VARIANTS.includes(f.mouthVariant as MouthVariant)
  ) {
    return {
      hairVariant: f.hairVariant as HairVariant,
      eyesVariant: f.eyesVariant as EyesVariant,
      mouthVariant: f.mouthVariant as MouthVariant,
      eyebrowsVariant: (f.eyebrowsVariant as AvatarFeatures["eyebrowsVariant"]) ?? "neutral",
    };
  }
  return parseChoiceSeed(resolveAvatarSeed(person));
}

/** Encode features into seed so a pick stays reproducible */
export function choiceSeed(features: AvatarFeatures, salt?: string): string {
  const base = `${features.hairVariant}-${features.eyesVariant}-${features.mouthVariant}`;
  return salt ? `${base}-${salt}` : base;
}

export function parseChoiceSeed(seed: string): AvatarFeatures | null {
  const [hair, eyes, mouth] = seed.split("-");
  if (
    !hair ||
    !eyes ||
    !mouth ||
    !HAIR_VARIANTS.includes(hair as HairVariant) ||
    !EYES_VARIANTS.includes(eyes as EyesVariant) ||
    !MOUTH_VARIANTS.includes(mouth as MouthVariant)
  ) {
    return null;
  }
  return {
    hairVariant: hair as HairVariant,
    eyesVariant: eyes as EyesVariant,
    mouthVariant: mouth as MouthVariant,
    eyebrowsVariant: "neutral",
  };
}

export function choiceFromFeatures(
  features: AvatarFeatures,
  salt?: string
): AvatarChoice {
  return {
    ...features,
    eyebrowsVariant: features.eyebrowsVariant ?? "neutral",
    seed: choiceSeed(features, salt),
  };
}

function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)]!;
}

function randomSalt(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().slice(0, 6);
  }
  return Math.random().toString(36).slice(2, 8);
}

/** One random Toon Head look */
export function randomAvatarChoice(): AvatarChoice {
  return choiceFromFeatures(
    {
      hairVariant: pick(HAIR_VARIANTS),
      eyesVariant: pick(EYES_VARIANTS),
      mouthVariant: pick(MOUTH_VARIANTS),
      eyebrowsVariant: "neutral",
    },
    randomSalt()
  );
}

/** Small batch for the picker — light, not the full combo grid */
export function randomAvatarBatch(
  count = AVATAR_PICKER_COUNT,
  prefer?: AvatarChoice | null
): AvatarChoice[] {
  const batch: AvatarChoice[] = [];
  const seen = new Set<string>();

  if (prefer) {
    batch.push(prefer);
    seen.add(prefer.seed);
  }

  let guard = 0;
  while (batch.length < count && guard < count * 20) {
    guard += 1;
    const next = randomAvatarChoice();
    const key = `${next.hairVariant}-${next.eyesVariant}-${next.mouthVariant}`;
    if (seen.has(next.seed) || seen.has(key)) continue;
    seen.add(next.seed);
    seen.add(key);
    batch.push(next);
  }

  while (batch.length < count) {
    batch.push(randomAvatarChoice());
  }

  return batch;
}

function backgroundForSeed(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return BACKGROUNDS[hash % BACKGROUNDS.length]!;
}

/** Stable DiceBear Toon Head URL for a person (or draft choice). */
export function avatarUrl(
  person: AvatarPerson,
  opts?: {
    size?: number;
    style?: string;
    seed?: string;
    features?: AvatarFeatures | null;
  }
): string {
  const seed = opts?.seed?.trim() || resolveAvatarSeed(person);
  const features =
    opts?.features !== undefined
      ? opts.features
      : resolveAvatarFeatures({ ...person, avatar_seed: seed });
  const size = Math.max(64, Math.min(4096, opts?.size ?? 128));
  const params = new URLSearchParams({
    seed,
    size: String(size),
    radius: "50",
    backgroundColor: backgroundForSeed(seed),
  });
  if (features) {
    params.set("hairVariant", features.hairVariant);
    params.set("eyesVariant", features.eyesVariant);
    params.set("mouthVariant", features.mouthVariant);
    params.set("eyebrowsVariant", features.eyebrowsVariant ?? "neutral");
  }
  return `https://api.dicebear.com/10.x/${AVATAR_STYLE}/png?${params.toString()}`;
}

export function findGalleryChoice(seed: string): AvatarChoice | undefined {
  const features = parseChoiceSeed(seed);
  if (!features) return undefined;
  return { ...features, seed };
}
