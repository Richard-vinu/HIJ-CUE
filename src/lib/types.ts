export type TaskStatus = "To do" | "In progress" | "Done";

export type Person = {
  id: string;
  slug: string;
  name: string;
  email: string;
  is_admin: boolean;
  auth_user_id: string | null;
  created_at: string;
};

export type Task = {
  id: string;
  title: string;
  description: string;
  assignee_id: string | null;
  due_date: string;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
  assignee?: Person | null;
};

export type Comment = {
  id: string;
  task_id: string;
  author_id: string;
  body: string;
  created_at: string;
  author?: Person | null;
};

export type Attachment = {
  id: string;
  task_id: string;
  name: string;
  size_bytes: number;
  storage_path: string;
  mime_type: string | null;
  uploaded_by: string | null;
  created_at: string;
  uploader?: Person | null;
};

export const TASK_STATUSES: TaskStatus[] = ["To do", "In progress", "Done"];
