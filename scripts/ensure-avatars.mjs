/**
 * Ensures avatar storage is ready and verifies save/load.
 * Run: node scripts/ensure-avatars.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import WebSocket from "ws";

function loadEnv() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i === -1) continue;
    const key = trimmed.slice(0, i);
    const value = trimmed.slice(i + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv();

const PATH = "meta/people-avatars.json";
const BUCKET = "task-files";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing Supabase env in .env.local");
    process.exit(1);
  }

  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket },
  });

  const { data: people, error: peopleErr } = await sb
    .from("people")
    .select("id, name")
    .limit(1);
  if (peopleErr) throw peopleErr;
  if (!people?.length) {
    console.error("No people rows found");
    process.exit(1);
  }

  const { data: existing } = await sb.storage.from(BUCKET).download(PATH);
  let map = {};
  if (existing) {
    try {
      map = JSON.parse(await existing.text());
    } catch {
      map = {};
    }
  }

  const sampleId = people[0].id;
  map[sampleId] = map[sampleId] || {
    style: "toon-head",
    seed: people[0].name,
  };

  const { error: upErr } = await sb.storage
    .from(BUCKET)
    .upload(PATH, JSON.stringify(map), {
      contentType: "application/json",
      upsert: true,
    });
  if (upErr) throw upErr;

  const { data: verify, error: downErr } = await sb.storage
    .from(BUCKET)
    .download(PATH);
  if (downErr) throw downErr;
  const roundtrip = JSON.parse(await verify.text());
  if (!roundtrip[sampleId]?.style) {
    console.error("Avatar roundtrip failed");
    process.exit(1);
  }

  // Probe DB columns (optional)
  const { error: colErr } = await sb
    .from("people")
    .select("avatar_style, avatar_seed")
    .limit(1);
  if (colErr) {
    console.log(
      "✓ Avatars ready via Storage (DB columns not present yet — optional)"
    );
    console.log(
      "  Optional later: run supabase/avatars.sql in the SQL editor"
    );
  } else {
    console.log("✓ Avatars ready (Storage + DB columns)");
  }
  console.log(`✓ Sample map entry for ${people[0].name}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
