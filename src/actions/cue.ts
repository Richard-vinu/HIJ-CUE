"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { getCurrentAdmin } from "@/lib/data";
import {
  findGalleryChoice,
  isAvatarStyle,
  type AvatarFeatures,
} from "@/lib/avatar";
import { savePersonAvatar } from "@/lib/avatars-store";
import { saveSiteBanner } from "@/lib/banner-store";
import {
  deleteEventById,
  upsertEvent,
} from "@/lib/events-store";
import type { CueEvent } from "@/lib/events";
import { savePersonRole } from "@/lib/roles-store";
import {
  addRoleOption,
  removeRoleOption,
} from "@/lib/role-options-store";
import { isSuperAdmin, TASK_STATUSES, type TaskStatus } from "@/lib/types";

async function requireAdmin() {
  return getCurrentAdmin();
}

export async function signInAdmin(email: string, password: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  const admin = await getCurrentAdmin();
  if (!admin) {
    await supabase.auth.signOut();
    return { error: "This account is not an admin." };
  }
  return { ok: true as const };
}

export async function signOutAdmin() {
  const supabase = await createClient();
  // Local scope clears cookies without a slow remote revoke round-trip.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/admin/login");
}

export async function createTask(input: {
  title: string;
  description: string;
  assignee_id: string;
  due_date: string;
}) {
  if (!(await requireAdmin())) {
    return { error: "Admin access required. Sign in again." };
  }
  const title = input.title.trim();
  if (!title) return { error: "A task needs a title so people know what to do." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.due_date)) {
    return { error: "Pick a due date." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      title,
      description: input.description.trim(),
      assignee_id: input.assignee_id || null,
      due_date: input.due_date,
      status: "To do",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/");
  revalidatePath("/admin");
  return { id: data.id };
}

export async function updateTask(
  id: string,
  patch: Partial<{
    title: string;
    description: string;
    assignee_id: string | null;
    due_date: string;
    status: TaskStatus;
  }>
) {
  const supabase = await createClient();

  // Status-only updates allowed for everyone; other fields require admin
  const keys = Object.keys(patch);
  const statusOnly = keys.length === 1 && keys[0] === "status";
  if (!statusOnly && !(await requireAdmin())) {
    return { error: "Admin access required. Sign in again." };
  }
  if (
    patch.status !== undefined &&
    !TASK_STATUSES.includes(patch.status)
  ) {
    return { error: "Invalid status." };
  }
  if (patch.due_date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(patch.due_date)) {
    return { error: "Pick a valid due date." };
  }
  if (patch.title !== undefined && !patch.title.trim()) {
    return { error: "A task needs a title so people know what to do." };
  }

  const { error } = await supabase.from("tasks").update(patch).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/");
  revalidatePath("/admin");
  return { ok: true as const };
}

export async function deleteTask(id: string) {
  if (!(await requireAdmin())) {
    return { error: "Admin access required. Sign in again." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/");
  revalidatePath("/admin");
  return { ok: true as const };
}

/** Admin: update the team-page event marquee message. */
export async function updateBannerMessage(message: string) {
  if (!(await requireAdmin())) {
    return { error: "Admin access required. Sign in again." };
  }
  const result = await saveSiteBanner(message);
  if (result.error) return { error: result.error };
  revalidatePath("/");
  revalidatePath("/admin/team");
  return { ok: true as const };
}

/** Admin: create or update a church event. */
export async function saveEvent(input: {
  id?: string;
  title: string;
  date: string;
  endDate?: string | null;
}) {
  if (!(await requireAdmin())) {
    return { error: "Admin access required. Sign in again." };
  }
  const title = input.title.trim();
  if (!title) return { error: "Event needs a title." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    return { error: "Pick a valid start date." };
  }
  const endDate = input.endDate?.trim() || null;
  if (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return { error: "Pick a valid end date." };
  }
  if (endDate && endDate < input.date) {
    return { error: "End date can’t be before the start date." };
  }

  const event: CueEvent = {
    id: input.id || crypto.randomUUID(),
    title,
    date: input.date,
    endDate,
  };
  const result = await upsertEvent(event);
  if (result.error) return { error: result.error };
  revalidatePath("/");
  return { ok: true as const, id: event.id };
}

export async function removeEvent(id: string) {
  if (!(await requireAdmin())) {
    return { error: "Admin access required. Sign in again." };
  }
  if (!id) return { error: "Missing event." };
  const result = await deleteEventById(id);
  if (result.error) return { error: result.error };
  revalidatePath("/");
  return { ok: true as const };
}

/** Team or admin: set DiceBear Toon Head look (stored in Storage). */
export async function updateMyAvatar(
  personId: string,
  style: string,
  seed: string,
  features?: AvatarFeatures | null
) {
  if (!personId) return { error: "Pick who you are first." };
  if (!isAvatarStyle(style)) return { error: "Unknown avatar style." };
  const cleanSeed = seed.trim().slice(0, 64);
  if (!cleanSeed) return { error: "Pick a look, then save." };

  const resolvedFeatures =
    features ??
    (() => {
      const hit = findGalleryChoice(cleanSeed);
      if (!hit) return null;
      return {
        hairVariant: hit.hairVariant,
        eyesVariant: hit.eyesVariant,
        mouthVariant: hit.mouthVariant,
        eyebrowsVariant: hit.eyebrowsVariant ?? "neutral",
      };
    })();

  const service = createServiceClient();
  const { data: person, error: fetchError } = await service
    .from("people")
    .select("id")
    .eq("id", personId)
    .maybeSingle();

  if (fetchError) return { error: fetchError.message };
  if (!person) return { error: "Person not found." };

  // Prefer DB columns when present; always keep Storage copy so avatars work without migration.
  const { error: dbError } = await service
    .from("people")
    .update({ avatar_style: style, avatar_seed: cleanSeed })
    .eq("id", personId);

  if (dbError && !/avatar_style|avatar_seed|42703/i.test(dbError.message)) {
    return { error: dbError.message };
  }

  const stored = await savePersonAvatar(
    personId,
    style,
    cleanSeed,
    resolvedFeatures
  );
  if (stored.error) return { error: stored.error };

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/team");
  return { ok: true as const };
}

export async function addComment(
  taskId: string,
  authorId: string,
  body: string
) {
  const text = body.trim();
  if (!text) return { error: "Write a comment first." };
  if (!authorId) return { error: "Pick who you are before commenting." };
  if (text.length > 4000) return { error: "Comment is too long." };

  const supabase = await createClient();
  const [{ data: author }, { data: task }] = await Promise.all([
    supabase.from("people").select("id").eq("id", authorId).maybeSingle(),
    supabase.from("tasks").select("id").eq("id", taskId).maybeSingle(),
  ]);
  if (!author) return { error: "Unknown author." };
  if (!task) return { error: "Task not found." };

  const { error } = await supabase.from("comments").insert({
    task_id: taskId,
    author_id: authorId,
    body: text,
  });
  if (error) return { error: error.message };
  revalidatePath("/");
  revalidatePath("/admin");
  return { ok: true as const };
}

export async function addPerson(input: {
  name: string;
  email: string;
  is_admin: boolean;
  role?: string;
}) {
  const actor = await requireAdmin();
  if (!actor) return { error: "Admin access required. Sign in again." };
  if (input.is_admin && !isSuperAdmin(actor)) {
    return { error: "Only the super admin can add other admins." };
  }
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name) return { error: "Enter a name." };
  if (!email.includes("@") || email.length < 5) {
    return { error: "Enter a valid email address." };
  }

  const slug =
    name
      .toLowerCase()
      .replace(/^pastor\s+/, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || `person-${Date.now()}`;

  let authUserId: string | null = null;
  let tempPassword: string | undefined;

  if (input.is_admin) {
    const service = createServiceClient();
    tempPassword =
      process.env.ADMIN_SEED_PASSWORD ||
      `Cue-${Math.random().toString(36).slice(2, 10)}!`;

    const { data: listed, error: listError } =
      await service.auth.admin.listUsers({ perPage: 200 });
    if (listError) return { error: listError.message };

    const existing = listed.users.find(
      (u) => u.email?.toLowerCase() === email
    );

    if (existing) {
      authUserId = existing.id;
      const { error } = await service.auth.admin.updateUserById(existing.id, {
        password: tempPassword,
        email_confirm: true,
        user_metadata: { name, slug },
      });
      if (error) return { error: error.message };
    } else {
      const { data, error } = await service.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { name, slug },
      });
      if (error) return { error: error.message };
      authUserId = data.user?.id ?? null;
    }
  }

  const supabase = await createClient();
  const { data: inserted, error } = await supabase
    .from("people")
    .insert({
      name,
      email,
      slug,
      is_admin: input.is_admin,
      auth_user_id: authUserId,
    })
    .select("id")
    .single();
  if (error) {
    if (/duplicate|unique|already exists/i.test(error.message)) {
      return { error: "That email is already on the team." };
    }
    return { error: error.message };
  }

  if (inserted?.id && input.role?.trim()) {
    await savePersonRole(inserted.id, input.role);
  }

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/team");
  return {
    ok: true as const,
    ...(tempPassword ? { tempPassword } : {}),
  };
}

export async function updatePersonRole(personId: string, role: string) {
  if (!(await requireAdmin())) {
    return { error: "Admin access required. Sign in again." };
  }
  if (!personId) return { error: "Missing person." };
  const result = await savePersonRole(personId, role);
  if (result.error) return { error: result.error };
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/team");
  return { ok: true as const };
}

/** Admin: add a role to the shared dropdown catalog. */
export async function createRoleOption(role: string) {
  if (!(await requireAdmin())) {
    return { error: "Admin access required. Sign in again." };
  }
  const result = await addRoleOption(role);
  if (result.error) return { error: result.error };
  revalidatePath("/admin/team");
  return { ok: true as const, roles: result.roles };
}

/** Admin: remove a role from the shared dropdown catalog (doesn’t clear people). */
export async function deleteRoleOption(role: string) {
  if (!(await requireAdmin())) {
    return { error: "Admin access required. Sign in again." };
  }
  const result = await removeRoleOption(role);
  if (result.error) return { error: result.error };
  revalidatePath("/admin/team");
  return { ok: true as const, roles: result.roles };
}

/** Super admin only: grant or revoke admin panel access. */
export async function setPersonAdmin(personId: string, isAdmin: boolean) {
  const actor = await requireAdmin();
  if (!actor) return { error: "Admin access required. Sign in again." };
  if (!isSuperAdmin(actor)) {
    return { error: "Only the super admin can change admin access." };
  }
  if (!personId) return { error: "Missing person." };
  if (personId === actor.id) {
    return { error: "You cannot change your own admin access." };
  }

  const service = createServiceClient();
  const { data: person, error: fetchError } = await service
    .from("people")
    .select("id, email, name, slug, is_admin, is_super_admin, auth_user_id")
    .eq("id", personId)
    .maybeSingle();
  if (fetchError) return { error: fetchError.message };
  if (!person) return { error: "Person not found." };
  if (isSuperAdmin(person)) {
    return { error: "The super admin’s access can’t be changed." };
  }

  let authUserId = person.auth_user_id as string | null;
  let tempPassword: string | undefined;

  if (isAdmin && !authUserId) {
    tempPassword =
      process.env.ADMIN_SEED_PASSWORD ||
      `Cue-${Math.random().toString(36).slice(2, 10)}!`;
    const { data: listed, error: listError } =
      await service.auth.admin.listUsers({ perPage: 200 });
    if (listError) return { error: listError.message };
    const existing = listed.users.find(
      (u) => u.email?.toLowerCase() === person.email.toLowerCase()
    );
    if (existing) {
      authUserId = existing.id;
      const { error } = await service.auth.admin.updateUserById(existing.id, {
        password: tempPassword,
        email_confirm: true,
        user_metadata: { name: person.name, slug: person.slug },
      });
      if (error) return { error: error.message };
    } else {
      const { data, error } = await service.auth.admin.createUser({
        email: person.email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { name: person.name, slug: person.slug },
      });
      if (error) return { error: error.message };
      authUserId = data.user?.id ?? null;
    }
  }

  const { error } = await service
    .from("people")
    .update({
      is_admin: isAdmin,
      ...(authUserId ? { auth_user_id: authUserId } : {}),
    })
    .eq("id", personId);
  if (error) return { error: error.message };

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/team");
  return {
    ok: true as const,
    ...(tempPassword ? { tempPassword } : {}),
  };
}

export async function removePerson(id: string) {
  const admin = await requireAdmin();
  if (!admin) return { error: "Admin access required. Sign in again." };
  if (admin.id === id) {
    return { error: "You cannot remove yourself." };
  }

  const service = createServiceClient();
  const { data: person, error: fetchError } = await service
    .from("people")
    .select("id, auth_user_id, is_admin, is_super_admin, slug")
    .eq("id", id)
    .maybeSingle();
  if (fetchError) return { error: fetchError.message };
  if (!person) return { error: "Person not found." };

  if (isSuperAdmin(person)) {
    return { error: "The super admin cannot be removed." };
  }

  if (person.is_admin && !isSuperAdmin(admin)) {
    return { error: "Only the super admin can remove other admins." };
  }

  const { error } = await service.from("people").delete().eq("id", id);
  if (error) return { error: error.message };

  if (person.auth_user_id) {
    const { error: authError } = await service.auth.admin.deleteUser(
      person.auth_user_id
    );
    if (authError) {
      console.error("Failed to delete auth user", authError.message);
    }
  }

  // Drop stored role so it doesn’t linger
  await savePersonRole(id, "");

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/team");
  return { ok: true as const };
}

export async function deleteAttachment(
  attachmentId: string,
  requesterId?: string | null
) {
  const service = createServiceClient();
  const { data: file, error: fetchError } = await service
    .from("attachments")
    .select("id, storage_path, uploaded_by")
    .eq("id", attachmentId)
    .maybeSingle();

  if (fetchError) return { error: fetchError.message };
  if (!file) return { error: "File not found." };

  const admin = await getCurrentAdmin();
  const isUploader =
    !!requesterId && !!file.uploaded_by && requesterId === file.uploaded_by;

  if (!admin && !isUploader) {
    return { error: "Only the uploader or an admin can remove this file." };
  }

  const { error: storageError } = await service.storage
    .from("task-files")
    .remove([file.storage_path]);
  if (storageError) return { error: storageError.message };

  const { error } = await service
    .from("attachments")
    .delete()
    .eq("id", attachmentId);
  if (error) return { error: error.message };

  revalidatePath("/");
  revalidatePath("/admin");
  return { ok: true as const };
}

export async function uploadAttachment(formData: FormData) {
  const taskId = String(formData.get("taskId") || "");
  const uploadedBy = String(formData.get("uploadedBy") || "") || null;
  const file = formData.get("file");

  if (!taskId || !(file instanceof File) || file.size === 0) {
    return { error: "Choose a file to attach." };
  }

  const supabase = await createClient();
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${taskId}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("task-files")
    .upload(path, file, { contentType: file.type || undefined, upsert: false });

  if (uploadError) return { error: uploadError.message };

  const { error } = await supabase.from("attachments").insert({
    task_id: taskId,
    name: file.name,
    size_bytes: file.size,
    storage_path: path,
    mime_type: file.type || null,
    uploaded_by: uploadedBy,
  });

  if (error) return { error: error.message };
  revalidatePath("/");
  revalidatePath("/admin");
  return { ok: true as const };
}
