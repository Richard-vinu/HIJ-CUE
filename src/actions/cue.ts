"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAdmin } from "@/lib/data";
import type { TaskStatus } from "@/lib/types";

async function requireAdmin() {
  const admin = await getCurrentAdmin();
  if (!admin) throw new Error("Admin access required");
  return admin;
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
  await supabase.auth.signOut();
  revalidatePath("/admin");
  redirect("/admin/login");
}

export async function createTask(input: {
  title: string;
  description: string;
  assignee_id: string;
  due_date: string;
}) {
  await requireAdmin();
  const title = input.title.trim();
  if (!title) return { error: "A task needs a title so people know what to do." };

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
  if (!statusOnly) await requireAdmin();

  const { error } = await supabase.from("tasks").update(patch).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath(`/admin/tasks/${id}`);
  return { ok: true as const };
}

export async function deleteTask(id: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/");
  revalidatePath("/admin");
  return { ok: true as const };
}

export async function addComment(taskId: string, authorId: string, body: string) {
  const text = body.trim();
  if (!text) return { error: "Write a comment first." };
  if (!authorId) return { error: "Pick who you are before commenting." };

  const supabase = await createClient();
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
}) {
  await requireAdmin();
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name || !email.includes("@")) {
    return { error: "Name and a valid email are required." };
  }

  const slug = name
    .toLowerCase()
    .replace(/^pastor\s+/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const supabase = await createClient();
  const { error } = await supabase.from("people").insert({
    name,
    email,
    slug: slug || `person-${Date.now()}`,
    is_admin: input.is_admin,
  });
  if (error) return { error: error.message };
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/team");
  return { ok: true as const };
}

export async function removePerson(id: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("people").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/team");
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
