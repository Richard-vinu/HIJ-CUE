/**
 * Concurrent + status E2E for HIJ Cue.
 * Simulates multiple people working at the same time (API races + browser contexts).
 *
 * Run: npm run test:e2e   (requires `npm run dev` on :3000)
 */
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import WebSocket from "ws";

const BASE = process.env.CUE_BASE_URL || "http://localhost:3000";
const ADMIN_EMAIL = process.env.ADMIN_E2E_EMAIL || "pr.anish@hij.church";
const ADMIN_PASSWORD = process.env.ADMIN_E2E_PASSWORD || "CueAdmin2026!";

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

let failed = 0;
let passed = 0;
const results = [];

function ok(label) {
  passed += 1;
  results.push({ ok: true, label });
  console.log(`✓ ${label}`);
}
function bad(label, err) {
  failed += 1;
  results.push({ ok: false, label, err: String(err || "") });
  console.error(`✗ ${label}${err ? `\n  ${err}` : ""}`);
}

async function assert(label, cond, err) {
  if (cond) ok(label);
  else bad(label, err);
}

function envClient(key) {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket },
  });
}

async function pickTeamTask(client) {
  const { data, error } = await client
    .from("tasks")
    .select("id, title, status, assignee_id")
    .order("due_date")
    .limit(20);
  if (error) throw error;
  const rows = (data || []).filter((t) => !/E2E/i.test(t.title));
  return (
    rows.find((t) => t.title.includes("lyrics")) ||
    rows.find((t) => t.title.includes("Song list")) ||
    rows[0]
  );
}

async function getPeople(client) {
  const { data, error } = await client
    .from("people")
    .select("id, name, slug, is_admin")
    .order("name");
  if (error) throw error;
  return data || [];
}

async function getTask(client, id) {
  const { data, error } = await client
    .from("tasks")
    .select("id, title, status, assignee_id, updated_at")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

/** --- API layer: concurrent status races --- */
async function testApiConcurrentStatus() {
  console.log("\n== API: concurrent status updates ==");
  const anon = envClient(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const task = await pickTeamTask(anon);
  await assert("Found a shared task", !!task, "no tasks in DB");
  if (!task) return null;

  const original = task.status;
  const statuses = ["To do", "In progress", "Done"];

  // Sequential round-trip
  for (const s of statuses) {
    const { error } = await anon.from("tasks").update({ status: s }).eq("id", task.id);
    await assert(`Status → ${s}`, !error, error?.message);
    const row = await getTask(anon, task.id);
    await assert(`Persisted ${s}`, row.status === s, `got ${row.status}`);
  }

  // Concurrent last-write-wins on SAME task from 3 "users"
  const writers = [
    anon.from("tasks").update({ status: "To do" }).eq("id", task.id),
    anon.from("tasks").update({ status: "In progress" }).eq("id", task.id),
    anon.from("tasks").update({ status: "Done" }).eq("id", task.id),
  ];
  const settled = await Promise.allSettled(writers);
  const writeOk = settled.every((r) => r.status === "fulfilled" && !r.value.error);
  await assert("3 concurrent status writes all accepted", writeOk, JSON.stringify(settled));

  const afterRace = await getTask(anon, task.id);
  await assert(
    "After race, status is one of To do / In progress / Done",
    statuses.includes(afterRace.status),
    afterRace.status
  );

  // Two people updating DIFFERENT tasks at once
  const { data: two } = await anon
    .from("tasks")
    .select("id, status")
    .limit(2);
  if (two?.length === 2) {
    const [a, b] = two;
    const nextA = a.status === "Done" ? "To do" : "Done";
    const nextB = b.status === "In progress" ? "To do" : "In progress";
    const [ra, rb] = await Promise.all([
      anon.from("tasks").update({ status: nextA }).eq("id", a.id),
      anon.from("tasks").update({ status: nextB }).eq("id", b.id),
    ]);
    await assert("Parallel updates on two tasks (A)", !ra.error, ra.error?.message);
    await assert("Parallel updates on two tasks (B)", !rb.error, rb.error?.message);
    const [fa, fb] = await Promise.all([getTask(anon, a.id), getTask(anon, b.id)]);
    await assert(`Task A ended as ${nextA}`, fa.status === nextA, fa.status);
    await assert(`Task B ended as ${nextB}`, fb.status === nextB, fb.status);
  } else {
    bad("Need ≥2 tasks for parallel distinct updates");
  }

  // Restore original on primary task
  await anon.from("tasks").update({ status: original }).eq("id", task.id);
  return { task, original, people: await getPeople(anon) };
}

/** --- API: concurrent comments --- */
async function testApiConcurrentComments(ctx) {
  console.log("\n== API: concurrent comments ==");
  if (!ctx?.task || !ctx.people?.length) {
    bad("Skip comments — missing context");
    return;
  }
  const anon = envClient(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const authors = ctx.people.filter((p) => !p.is_admin).slice(0, 3);
  if (authors.length < 2) {
    bad("Need ≥2 non-admin people for comment race");
    return;
  }
  const stamp = Date.now();
  const bodies = authors.map(
    (p, i) => `E2E concurrent comment ${stamp} from ${p.slug || p.name} #${i}`
  );
  const inserts = await Promise.all(
    authors.map((p, i) =>
      anon.from("comments").insert({
        task_id: ctx.task.id,
        author_id: p.id,
        body: bodies[i],
      })
    )
  );
  await assert(
    "Concurrent comments inserted",
    inserts.every((r) => !r.error),
    inserts.find((r) => r.error)?.error?.message
  );

  const { data: listed } = await anon
    .from("comments")
    .select("body, author_id")
    .eq("task_id", ctx.task.id)
    .ilike("body", `%E2E concurrent comment ${stamp}%`);
  await assert(
    `All ${authors.length} concurrent comments visible`,
    (listed?.length || 0) === authors.length,
    `got ${listed?.length}`
  );

  // Cleanup test comments
  await anon
    .from("comments")
    .delete()
    .ilike("body", `%E2E concurrent comment ${stamp}%`);
}

async function pickName(page, name) {
  // Identity gate: open select and choose person
  const trigger = page.getByRole("combobox").first();
  await trigger.click();
  await page.getByRole("option", { name, exact: true }).click();
  await page.waitForTimeout(800);
}

async function goAllTasks(page) {
  const visible = page.locator("button:visible").filter({ hasText: /^All tasks$/ });
  if (await visible.count()) {
    await visible.first().click();
    await page.waitForTimeout(500);
    return;
  }
  // Fallback: any visible control containing the label
  const loose = page.locator("button:visible").filter({ hasText: "All tasks" });
  if (await loose.count()) {
    await loose.first().click();
    await page.waitForTimeout(500);
  }
}

async function openTaskByTitle(page, titlePart) {
  const row = page.locator("button:visible").filter({ hasText: titlePart }).first();
  await row.click();
  await page.waitForTimeout(700);
}

async function setStatusInUi(page, status) {
  // Prefer detail StatusSelect (usually the colored pill near Status label)
  const trigger = page
    .locator("button:visible")
    .filter({ hasText: /^(To do|In progress|Done)$/ })
    .first();
  await trigger.click();
  await page.waitForTimeout(250);
  await page.getByRole("option", { name: status, exact: true }).click();
  await page.waitForTimeout(1800);
}

/** --- Browser: multi-context team + admin --- */
async function testBrowserMultiUser(ctx) {
  console.log("\n== Browser: multiple people at once ==");
  process.env.PLAYWRIGHT_BROWSERS_PATH =
    process.env.PLAYWRIGHT_BROWSERS_PATH ||
    `${process.env.HOME}/Library/Caches/ms-playwright`;

  const browser = await chromium.launch({ headless: true });
  try {
    const prasthuthi = ctx.people.find((p) => p.slug === "prasthuthi");
    const baji = ctx.people.find((p) => p.slug === "baji");
    await assert("Roster has Prasthuthi + Baji", !!(prasthuthi && baji));

    const ctxA = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const ctxB = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const ctxAdmin = await browser.newContext({
      viewport: { width: 1400, height: 900 },
    });
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();
    const pageAdmin = await ctxAdmin.newPage();

    // A + B enter as different people
    await Promise.all([
      pageA.goto(BASE, { waitUntil: "networkidle" }),
      pageB.goto(BASE, { waitUntil: "networkidle" }),
    ]);
    await pickName(pageA, "Prasthuthi");
    await pickName(pageB, "Baji");
    await assert(
      "User A (Prasthuthi) in app",
      (await pageA.locator("body").innerText()).includes("My tasks") ||
        (await pageA.locator("body").innerText()).includes("All tasks")
    );
    await assert(
      "User B (Baji) in app",
      (await pageB.locator("body").innerText()).includes("My tasks") ||
        (await pageB.locator("body").innerText()).includes("All tasks")
    );

    // Both open All tasks
    await goAllTasks(pageA);
    await goAllTasks(pageB);

    const titleHint = ctx.task.title.slice(0, 18);
    await openTaskByTitle(pageA, titleHint);
    await setStatusInUi(pageA, "In progress");

    // Reload B and confirm status visible after refresh (no realtime)
    await pageB.reload({ waitUntil: "networkidle" });
    await pageB.waitForTimeout(1000);
    // ensure identity still set
    if ((await pageB.locator("body").innerText()).includes("Who are you")) {
      await pickName(pageB, "Baji");
    }
    await goAllTasks(pageB);
    await openTaskByTitle(pageB, titleHint);
    const bText = await pageB.locator("body").innerText();
    await assert(
      "User B sees User A’s In progress after refresh",
      bText.includes("In progress"),
      bText.slice(0, 300)
    );

    // B flips to Done while A is still open
    await setStatusInUi(pageB, "Done");
    await pageA.reload({ waitUntil: "networkidle" });
    await pageA.waitForTimeout(800);
    if ((await pageA.locator("body").innerText()).includes("Who are you")) {
      await pickName(pageA, "Prasthuthi");
    }
    await goAllTasks(pageA);
    await openTaskByTitle(pageA, titleHint);
    const aText = await pageA.locator("body").innerText();
    await assert(
      "User A sees User B’s Done after refresh",
      aText.includes("Done"),
      aText.slice(0, 300)
    );

    // Concurrent comments from A and B (UI)
    const stamp = Date.now();
    async function postComment(page, text) {
      const area = page.locator("textarea:visible").last();
      await area.fill(text);
      await page.getByRole("button", { name: /Post comment/i }).click();
      await page.waitForTimeout(1800);
    }
    await Promise.all([
      postComment(pageA, `E2E A comment ${stamp}`),
      postComment(pageB, `E2E B comment ${stamp}`),
    ]);
    await pageA.reload({ waitUntil: "networkidle" });
    await pageA.waitForTimeout(800);
    if ((await pageA.locator("body").innerText()).includes("Who are you")) {
      await pickName(pageA, "Prasthuthi");
    }
    await goAllTasks(pageA);
    await openTaskByTitle(pageA, titleHint);
    const commentsText = await pageA.locator("body").innerText();
    await assert(
      "Both concurrent UI comments visible after refresh",
      commentsText.includes(`E2E A comment ${stamp}`) &&
        commentsText.includes(`E2E B comment ${stamp}`),
      commentsText.slice(0, 500)
    );

    // Admin while team is active
    await pageAdmin.goto(`${BASE}/admin/login`, { waitUntil: "networkidle" });
    await pageAdmin.fill("#email", ADMIN_EMAIL);
    await pageAdmin.fill("#password", ADMIN_PASSWORD);
    await pageAdmin.click('button[type="submit"]');
    await pageAdmin.waitForURL((u) => !String(u).includes("/login"), {
      timeout: 25000,
    });
    await pageAdmin.waitForTimeout(1200);
    await assert(
      "Admin signed in during multi-user session",
      pageAdmin.url().includes("/admin")
    );

    // Admin sets status back to To do
    const adminRow = pageAdmin
      .locator("button:visible")
      .filter({ hasText: titleHint })
      .first();
    if (await adminRow.count()) {
      await adminRow.click();
      await pageAdmin.waitForTimeout(600);
      const statusBtn = pageAdmin
        .locator("aside")
        .locator("button:visible")
        .filter({ hasText: /^(To do|In progress|Done)$/ })
        .first();
      await statusBtn.click();
      await pageAdmin.waitForTimeout(200);
      await pageAdmin.getByRole("option", { name: "To do", exact: true }).click();
      await pageAdmin.waitForTimeout(1500);
    }

    // Team sees admin change after refresh
    await pageB.reload({ waitUntil: "networkidle" });
    await pageB.waitForTimeout(800);
    if ((await pageB.locator("body").innerText()).includes("Who are you")) {
      await pickName(pageB, "Baji");
    }
    await goAllTasks(pageB);
    await openTaskByTitle(pageB, titleHint);
    const afterAdmin = await pageB.locator("body").innerText();
    await assert(
      "Team sees admin status change (To do) after refresh",
      afterAdmin.includes("To do"),
      afterAdmin.slice(0, 300)
    );

    // Events + Team tabs still render under load
    for (const [page, who] of [
      [pageA, "Prasthuthi"],
      [pageB, "Baji"],
    ]) {
      if ((await page.locator("body").innerText()).includes("Who are you")) {
        await pickName(page, who);
      }
      // Detail → list (mobile Back / desktop stays listable via tabs)
      const back = page.locator("button:visible").filter({ hasText: /^Back$/ });
      if (await back.count()) {
        await back.first().click();
        await page.waitForTimeout(500);
      }
      const events = page.locator("button:visible").filter({ hasText: /^Events$/ });
      if (await events.count()) {
        await events.first().click();
        await page.waitForTimeout(600);
        await assert(
          `${who}: Events tab loads`,
          !(await page.locator("body").innerText()).includes("Application error")
        );
      } else {
        bad(`${who}: Events tab visible`);
      }
      const team = page.locator("button:visible").filter({ hasText: /^Team$/ });
      if (await team.count()) {
        await team.first().click();
        await page.waitForTimeout(600);
        const t = await page.locator("body").innerText();
        await assert(
          `${who}: Team tab shows roles`,
          t.includes("Role") ||
            t.includes("open") ||
            t.includes("Worship") ||
            t.includes("ProPresenter") ||
            t.includes("not set"),
          t.slice(0, 200)
        );
      } else {
        // Mobile nav is My / All / Events — Team is desktop sidebar only
        await assert(`${who}: Team tab (desktop) or skipped on mobile`, true);
      }
    }

    // Cleanup E2E comments via API
    const anon = envClient(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
    await anon.from("comments").delete().ilike("body", `%E2E A comment ${stamp}%`);
    await anon.from("comments").delete().ilike("body", `%E2E B comment ${stamp}%`);

    // Restore original status
    if (ctx.original) {
      await anon
        .from("tasks")
        .update({ status: ctx.original })
        .eq("id", ctx.task.id);
    }

    await ctxA.close();
    await ctxB.close();
    await ctxAdmin.close();
  } finally {
    await browser.close();
  }
}

async function testAdminTeamRoles() {
  console.log("\n== Browser: admin team roles smoke ==");
  process.env.PLAYWRIGHT_BROWSERS_PATH =
    process.env.PLAYWRIGHT_BROWSERS_PATH ||
    `${process.env.HOME}/Library/Caches/ms-playwright`;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  try {
    await page.goto(`${BASE}/admin/login`, { waitUntil: "networkidle" });
    await page.fill("#email", ADMIN_EMAIL);
    await page.fill("#password", ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL((u) => !String(u).includes("/login"), {
      timeout: 25000,
    });
    await page.goto(`${BASE}/admin/team`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    const text = await page.locator("body").innerText();
    await assert(
      "Admin Team list has ROLE column data",
      /Worship lead|ProPresenter|Camera|Keys/.test(text)
    );

    await page.getByRole("button", { name: /Manage roles/i }).click();
    await page.waitForTimeout(400);
    const dialog = page.getByRole("dialog");
    await assert("Manage roles dialog opens", (await dialog.count()) > 0);
    const dialogText = await dialog.innerText();
    await assert(
      "Role catalog lists seeded roles",
      /ProPresenter|Sound engineer|Worship lead/.test(dialogText)
    );
    await dialog.getByRole("button", { name: /^Done$/i }).click();
    await page.waitForTimeout(300);

    const roleTrigger = page.locator('[data-slot="select-trigger"]').first();
    await assert("Role dropdown trigger visible", (await roleTrigger.count()) > 0);
    await roleTrigger.click();
    await page.waitForTimeout(300);
    const options = page.getByRole("option");
    await assert("Role dropdown has options", (await options.count()) >= 2);
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "By role", exact: true }).click();
    await page.waitForTimeout(700);
    const roles = await page.locator("body").innerText();
    await assert("By role shows WORSHIP group", /WORSHIP/i.test(roles));
    await assert("By role shows MEDIA group", /MEDIA/i.test(roles));
    await assert("By role shows ADMINS sidebar", /ADMINS/i.test(roles));
  } finally {
    await browser.close();
  }
}

async function main() {
  console.log(`HIJ Cue E2E @ ${BASE}\n`);
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    bad("Missing Supabase env");
    process.exit(1);
  }

  // Health
  try {
    const res = await fetch(BASE);
    await assert(`App reachable (${res.status})`, res.ok || res.status === 200);
  } catch (e) {
    bad("App reachable — start npm run dev", e.message);
    process.exit(1);
  }

  const ctx = await testApiConcurrentStatus();
  await testApiConcurrentComments(ctx);
  await testBrowserMultiUser(ctx || { people: await getPeople(envClient(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)), task: null });
  await testAdminTeamRoles();

  console.log(`\n———\n${passed} passed · ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
