import { createServiceClient } from "@/lib/supabase/admin";

const BUCKET = "task-files";
const PATH = "meta/site-banner.json";

export const DEFAULT_BANNER_MESSAGE =
  "Next upcoming event · Independence Day · 15 August";

export type SiteBanner = {
  message: string;
};

export async function loadSiteBanner(): Promise<SiteBanner> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.storage.from(BUCKET).download(PATH);
    if (error || !data) return { message: DEFAULT_BANNER_MESSAGE };
    const parsed = JSON.parse(await data.text()) as Partial<SiteBanner>;
    const message = parsed.message?.trim();
    return {
      message: message || DEFAULT_BANNER_MESSAGE,
    };
  } catch {
    return { message: DEFAULT_BANNER_MESSAGE };
  }
}

export async function saveSiteBanner(
  message: string
): Promise<{ error?: string }> {
  const clean = message.trim().slice(0, 200);
  if (!clean) return { error: "Banner message can’t be empty." };

  const supabase = createServiceClient();
  const body = JSON.stringify({ message: clean } satisfies SiteBanner);
  const { error } = await supabase.storage.from(BUCKET).upload(PATH, body, {
    contentType: "application/json",
    upsert: true,
  });
  if (error) return { error: error.message };
  return {};
}
