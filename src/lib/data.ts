import { createClient } from "@/lib/supabase/server";
import type { Attachment, Comment, Person, Task } from "@/lib/types";

export async function getPeople(): Promise<Person[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("people")
    .select("*")
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function getTasks(): Promise<Task[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("*, assignee:people!assignee_id(*)")
    .order("due_date");
  if (error) throw error;
  return (data as Task[]) ?? [];
}

export async function getTask(id: string): Promise<Task | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("*, assignee:people!assignee_id(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as Task | null;
}

export async function getComments(taskId: string): Promise<Comment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("comments")
    .select("*, author:people!author_id(*)")
    .eq("task_id", taskId)
    .order("created_at");
  if (error) throw error;
  return (data as Comment[]) ?? [];
}

export async function getAttachments(taskId: string): Promise<Attachment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attachments")
    .select("*, uploader:people!uploaded_by(*)")
    .eq("task_id", taskId)
    .order("created_at");
  if (error) throw error;
  return (data as Attachment[]) ?? [];
}

export async function getCurrentAdmin(): Promise<Person | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("people")
    .select("*")
    .eq("auth_user_id", user.id)
    .eq("is_admin", true)
    .maybeSingle();

  if (error) throw error;
  return data;
}
