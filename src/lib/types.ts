export type TaskStatus = "To do" | "In progress" | "Done";

export type Person = {
  id: string;
  slug: string;
  name: string;
  email: string;
  is_admin: boolean;
  is_super_admin?: boolean;
  /** Free-text ministry role (Worship lead, ProPresenter, …) */
  role?: string | null;
  /** DiceBear style id — always toon-head */
  avatar_style?: string | null;
  /** DiceBear seed / gallery id */
  avatar_seed?: string | null;
  /** Locked Toon Head face features (from gallery pick) */
  avatar_features?: {
    hairVariant: string;
    eyesVariant: string;
    mouthVariant: string;
    eyebrowsVariant?: string;
  } | null;
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

/** Pastor Anish is always treated as super admin (slug fallback if column missing). */
export function isSuperAdmin(
  person: Pick<Person, "slug"> & { is_super_admin?: boolean } | null | undefined
): boolean {
  if (!person) return false;
  if (person.is_super_admin) return true;
  return person.slug === "anish";
}

/** Visual tone classes for status chips / dropdowns */
export function statusClasses(status: TaskStatus) {
  switch (status) {
    case "To do":
      return {
        trigger:
          "border-amber-500/35 bg-amber-500/15 text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/15 dark:text-amber-100",
        item: "text-amber-900 dark:text-amber-100",
        dot: "bg-amber-500",
        label: "To do",
      };
    case "In progress":
      return {
        trigger:
          "border-sky-500/35 bg-sky-500/15 text-sky-900 dark:border-sky-400/30 dark:bg-sky-400/15 dark:text-sky-100",
        item: "text-sky-900 dark:text-sky-100",
        dot: "bg-sky-500",
        label: "In progress",
      };
    case "Done":
      return {
        trigger:
          "border-emerald-500/35 bg-emerald-500/15 text-emerald-900 dark:border-emerald-400/30 dark:bg-emerald-400/15 dark:text-emerald-100",
        item: "text-emerald-900 dark:text-emerald-100",
        dot: "bg-emerald-500",
        label: "Done",
      };
  }
}
