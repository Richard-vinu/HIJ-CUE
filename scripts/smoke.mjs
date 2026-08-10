/**
 * Smoke checks against Supabase for HIJ Cue production readiness.
 * Run: node scripts/smoke.mjs
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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

let failed = 0;
function ok(label) {
  console.log(`✓ ${label}`);
}
function bad(label, err) {
  failed += 1;
  console.error(`✗ ${label}`);
  if (err) console.error(`  ${err}`);
}

async function main() {
  if (!url || !anon) {
    bad("Env: NEXT_PUBLIC_SUPABASE_URL + PUBLISHABLE_KEY");
    process.exit(1);
  }
  ok("Env: public Supabase keys present");

  if (!service) bad("Env: SUPABASE_SERVICE_ROLE_KEY missing (needed for admin deletes / seed)");
  else ok("Env: service role key present");

  const client = createClient(url, anon, {
    realtime: { transport: WebSocket },
  });

  const { data: people, error: peopleErr } = await client
    .from("people")
    .select("id, name, is_admin, auth_user_id")
    .limit(50);
  if (peopleErr) bad("Read people", peopleErr.message);
  else ok(`Read people (${people.length})`);

  const admins = (people || []).filter((p) => p.is_admin);
  if (admins.length === 0) bad("At least one admin in people");
  else ok(`Admins in roster: ${admins.length}`);

  const linked = admins.filter((p) => p.auth_user_id);
  if (linked.length === 0) {
    bad("No admin has auth_user_id — run npm run seed:admins");
  } else ok(`Admins linked to Auth: ${linked.length}`);

  const { data: tasks, error: tasksErr } = await client
    .from("tasks")
    .select("id, title, status, due_date")
    .limit(50);
  if (tasksErr) bad("Read tasks", tasksErr.message);
  else ok(`Read tasks (${tasks.length})`);

  const { error: commentsErr } = await client
    .from("comments")
    .select("id")
    .limit(1);
  if (commentsErr) bad("Read comments", commentsErr.message);
  else ok("Read comments");

  const { error: filesErr } = await client
    .from("attachments")
    .select("id")
    .limit(1);
  if (filesErr) bad("Read attachments", filesErr.message);
  else ok("Read attachments");

  const { data: buckets, error: bucketErr } = service
    ? await createClient(url, service, {
        auth: { autoRefreshToken: false, persistSession: false },
        realtime: { transport: WebSocket },
      }).storage.listBuckets()
    : await client.storage.listBuckets();
  if (bucketErr) bad("List storage buckets", bucketErr.message);
  else if (!(buckets || []).some((b) => b.id === "task-files" || b.name === "task-files")) {
    bad("Storage bucket task-files missing — create it in Supabase Storage");
  } else ok("Storage bucket task-files exists");

  if (service) {
    const admin = createClient(url, service, {
      auth: { autoRefreshToken: false, persistSession: false },
      realtime: { transport: WebSocket },
    });
    const { data: avatarFile, error: avatarErr } = await admin.storage
      .from("task-files")
      .download("meta/people-avatars.json");
    if (avatarErr) {
      bad(
        "Avatar store missing — run npm run ensure:avatars",
        avatarErr.message
      );
    } else {
      ok(`Avatar store ready (${(await avatarFile.text()).length} bytes)`);
    }

    const { data: users, error: usersErr } =
      await admin.auth.admin.listUsers({ perPage: 20 });
    if (usersErr) bad("Auth admin listUsers", usersErr.message);
    else ok(`Auth users listed (${users.users.length})`);
  }

  console.log("");
  if (failed) {
    console.error(`Smoke failed: ${failed} check(s)`);
    process.exit(1);
  }
  console.log("Smoke passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
