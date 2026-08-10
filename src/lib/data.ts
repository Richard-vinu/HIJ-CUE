import { createClient } from "@/lib/supabase/server";
import {
  loadAvatarMap,
  withAvatar,
  withAvatars,
} from "@/lib/avatars-store";
import { loadSiteBanner } from "@/lib/banner-store";
import { loadEvents } from "@/lib/events-store";
import { loadRoleMap, withRole, withRoles } from "@/lib/roles-store";
import { loadRoleOptions } from "@/lib/role-options-store";
import type { CueEvent } from "@/lib/events";
import type { Attachment, Comment, Person, Task } from "@/lib/types";

export async function getBannerMessage(): Promise<string> {
  const banner = await loadSiteBanner();
  return banner.message;
}

export async function getRoleOptions(): Promise<string[]> {
  return loadRoleOptions();
}

export async function getEvents(): Promise<CueEvent[]> {
  return loadEvents();
}

export async function getPeople(): Promise<Person[]> {
  const supabase = await createClient();
  const [{ data, error }, avatarMap] = await Promise.all([
    supabase.from("people").select("*").order("name"),
    loadAvatarMap(),
  ]);
  if (error) throw error;
  const people = withAvatars((data as Person[]) ?? [], avatarMap);
  const roleMap = await loadRoleMap(people);
  return withRoles(people, roleMap);
}

export async function getTasks(): Promise<Task[]> {
  const supabase = await createClient();
  const [{ data, error }, avatarMap, roleMap] = await Promise.all([
    supabase
      .from("tasks")
      .select("*, assignee:people!assignee_id(*)")
      .order("due_date"),
    loadAvatarMap(),
    loadRoleMap(),
  ]);
  if (error) throw error;
  return ((data as Task[]) ?? []).map((t) => ({
    ...t,
    assignee: withRole(withAvatar(t.assignee, avatarMap), roleMap),
  }));
}

export async function getTask(id: string): Promise<Task | null> {
  const supabase = await createClient();
  const [{ data, error }, avatarMap, roleMap] = await Promise.all([
    supabase
      .from("tasks")
      .select("*, assignee:people!assignee_id(*)")
      .eq("id", id)
      .maybeSingle(),
    loadAvatarMap(),
    loadRoleMap(),
  ]);
  if (error) throw error;
  if (!data) return null;
  const task = data as Task;
  return {
    ...task,
    assignee: withRole(withAvatar(task.assignee, avatarMap), roleMap),
  };
}

export async function getComments(taskId: string): Promise<Comment[]> {
  const supabase = await createClient();
  const [{ data, error }, avatarMap, roleMap] = await Promise.all([
    supabase
      .from("comments")
      .select("*, author:people!author_id(*)")
      .eq("task_id", taskId)
      .order("created_at"),
    loadAvatarMap(),
    loadRoleMap(),
  ]);
  if (error) throw error;
  return ((data as Comment[]) ?? []).map((c) => ({
    ...c,
    author: withRole(withAvatar(c.author, avatarMap), roleMap),
  }));
}

export async function getAttachments(taskId: string): Promise<Attachment[]> {
  const supabase = await createClient();
  const [{ data, error }, avatarMap, roleMap] = await Promise.all([
    supabase
      .from("attachments")
      .select("*, uploader:people!uploaded_by(*)")
      .eq("task_id", taskId)
      .order("created_at"),
    loadAvatarMap(),
    loadRoleMap(),
  ]);
  if (error) throw error;
  return ((data as Attachment[]) ?? []).map((a) => ({
    ...a,
    uploader: withRole(withAvatar(a.uploader, avatarMap), roleMap),
  }));
}

/** One round-trip each for comments + attachments across many tasks (avoids N+1). */
export async function getTaskExtras(taskIds: string[]): Promise<{
  commentsByTask: Record<string, Comment[]>;
  attachmentsByTask: Record<string, Attachment[]>;
}> {
  const commentsByTask: Record<string, Comment[]> = {};
  const attachmentsByTask: Record<string, Attachment[]> = {};
  for (const id of taskIds) {
    commentsByTask[id] = [];
    attachmentsByTask[id] = [];
  }
  if (taskIds.length === 0) {
    return { commentsByTask, attachmentsByTask };
  }

  const supabase = await createClient();
  const [commentsRes, filesRes, avatarMap, roleMap] = await Promise.all([
    supabase
      .from("comments")
      .select("*, author:people!author_id(*)")
      .in("task_id", taskIds)
      .order("created_at"),
    supabase
      .from("attachments")
      .select("*, uploader:people!uploaded_by(*)")
      .in("task_id", taskIds)
      .order("created_at"),
    loadAvatarMap(),
    loadRoleMap(),
  ]);

  if (commentsRes.error) throw commentsRes.error;
  if (filesRes.error) throw filesRes.error;

  for (const c of (commentsRes.data as Comment[]) ?? []) {
    (commentsByTask[c.task_id] ??= []).push({
      ...c,
      author: withRole(withAvatar(c.author, avatarMap), roleMap),
    });
  }
  for (const f of (filesRes.data as Attachment[]) ?? []) {
    (attachmentsByTask[f.task_id] ??= []).push({
      ...f,
      uploader: withRole(withAvatar(f.uploader, avatarMap), roleMap),
    });
  }

  return { commentsByTask, attachmentsByTask };
}

export async function getCurrentAdmin(): Promise<Person | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data, error }, avatarMap, roleMap] = await Promise.all([
    supabase
      .from("people")
      .select("*")
      .eq("auth_user_id", user.id)
      .eq("is_admin", true)
      .maybeSingle(),
    loadAvatarMap(),
    loadRoleMap(),
  ]);

  if (error) throw error;
  return withRole(withAvatar(data as Person | null, avatarMap), roleMap);
}
