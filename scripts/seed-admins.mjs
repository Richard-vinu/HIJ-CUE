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
const defaultPassword = process.env.ADMIN_SEED_PASSWORD || "CueAdmin2026!";

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

function toHijCom(email) {
  return String(email || "")
    .trim()
    .toLowerCase()
    .replace(/@hij\.church$/i, "@hij.com");
}

const admins = [
  {
    slug: "anish",
    email: "pr.anish@hij.com",
    name: "Pastor Anish",
    password: process.env.ADMIN_SEED_PASSWORD_ANISH || defaultPassword,
    previousEmails: ["pr.anish@hij.church"],
  },
  {
    slug: "sushma",
    email: "sushma@hij.com",
    name: "Sushma",
    password: process.env.ADMIN_SEED_PASSWORD_SUSHMA || "CueAdmin2026Su!",
    previousEmails: ["sushma@hij.church"],
  },
  {
    slug: "deepak",
    email: "deepak@hij.com",
    name: "Deepak",
    password: process.env.ADMIN_SEED_PASSWORD_DEEPAK || "CueAdmin2026De!",
    previousEmails: ["deepak@hij.church"],
  },
];

async function ensureAdmin(admin) {
  const password = admin.password;
  const { data: listed, error: listError } =
    await supabase.auth.admin.listUsers({ perPage: 200 });
  if (listError) throw listError;

  let user = listed.users.find(
    (u) => u.email?.toLowerCase() === admin.email.toLowerCase()
  );

  // Migrate from a previous email if the new one doesn’t exist yet
  if (!user && admin.previousEmails?.length) {
    for (const oldEmail of admin.previousEmails) {
      const legacy = listed.users.find(
        (u) => u.email?.toLowerCase() === oldEmail.toLowerCase()
      );
      if (!legacy) continue;
      const { data, error } = await supabase.auth.admin.updateUserById(
        legacy.id,
        {
          email: admin.email,
          password,
          email_confirm: true,
          user_metadata: { name: admin.name, slug: admin.slug },
        }
      );
      if (error) throw error;
      user = data.user;
      console.log(`Migrated auth email: ${oldEmail} → ${admin.email}`);
      break;
    }
  }

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
    .update({
      auth_user_id: user.id,
      is_admin: true,
      email: admin.email,
    })
    .eq("slug", admin.slug);

  if (linkError) throw linkError;
  console.log(`Linked ${admin.slug} → ${user.id}`);
}

/** Move every people.email from @hij.church → @hij.com */
async function migratePeopleEmails() {
  const { data: people, error } = await supabase
    .from("people")
    .select("id, slug, email");
  if (error) throw error;

  let updated = 0;
  for (const person of people || []) {
    const next = toHijCom(person.email);
    if (!next || next === String(person.email || "").trim().toLowerCase()) {
      continue;
    }
    const { error: upErr } = await supabase
      .from("people")
      .update({ email: next })
      .eq("id", person.id);
    if (upErr) throw upErr;
    updated += 1;
    console.log(`people email: ${person.email} → ${next}`);
  }
  console.log(`Migrated ${updated} people email(s) to @hij.com`);
}

await migratePeopleEmails();

for (const admin of admins) {
  await ensureAdmin(admin);
}

console.log("\nAdmin seed complete.");
for (const admin of admins) {
  console.log(`- ${admin.email}`);
}
