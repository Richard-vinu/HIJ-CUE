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
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.ADMIN_SEED_PASSWORD || "CueAdmin2026!";

if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: WebSocket },
});

const admins = [
  {
    slug: "anish",
    email: "pr.anish@hij.church",
    name: "Pastor Anish",
  },
  {
    slug: "sushma",
    email: "sushma@hij.church",
    name: "Sushma",
  },
  {
    slug: "deepak",
    email: "deepak@hij.church",
    name: "Deepak",
  },
];

async function ensureAdmin(admin) {
  const { data: listed, error: listError } =
    await supabase.auth.admin.listUsers({ perPage: 200 });
  if (listError) throw listError;

  let user = listed.users.find(
    (u) => u.email?.toLowerCase() === admin.email.toLowerCase()
  );

  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: admin.email,
      password,
      email_confirm: true,
      user_metadata: { name: admin.name, slug: admin.slug },
    });
    if (error) throw error;
    user = data.user;
    console.log(`Created auth user: ${admin.email}`);
  } else {
    const { error } = await supabase.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
      user_metadata: { name: admin.name, slug: admin.slug },
    });
    if (error) throw error;
    console.log(`Updated auth user: ${admin.email}`);
  }

  const { error: linkError } = await supabase
    .from("people")
    .update({ auth_user_id: user.id, is_admin: true })
    .eq("slug", admin.slug);

  if (linkError) throw linkError;
  console.log(`Linked ${admin.slug} → ${user.id}`);
}

for (const admin of admins) {
  await ensureAdmin(admin);
}

console.log("\nAdmin seed complete.");
console.log(`Password for all admins: ${password}`);
console.log("Emails: pr.anish@hij.church, sushma@hij.church, deepak@hij.church");
