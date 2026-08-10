import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAdmin } from "@/lib/data";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const taskId = String(formData.get("taskId") || "");
    const uploadedBy = String(formData.get("uploadedBy") || "") || null;
    const file = formData.get("file");

    if (!taskId || !(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        { error: "Choose a file to attach." },
        { status: 400 }
      );
    }

    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File must be under 50 MB." },
        { status: 413 }
      );
    }

    const supabase = await createClient();
    const admin = await getCurrentAdmin();

    // Team uploads must name a real person; admins may upload without one.
    if (!admin) {
      if (!uploadedBy) {
        return NextResponse.json(
          { error: "Pick who you are before attaching a file." },
          { status: 401 }
        );
      }
      const { data: person } = await supabase
        .from("people")
        .select("id")
        .eq("id", uploadedBy)
        .maybeSingle();
      if (!person) {
        return NextResponse.json(
          { error: "Unknown uploader." },
          { status: 401 }
        );
      }
    }

    const { data: task } = await supabase
      .from("tasks")
      .select("id")
      .eq("id", taskId)
      .maybeSingle();
    if (!task) {
      return NextResponse.json({ error: "Task not found." }, { status: 404 });
    }

    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `${taskId}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("task-files")
      .upload(path, file, {
        contentType: file.type || undefined,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { error } = await supabase.from("attachments").insert({
      task_id: taskId,
      name: file.name,
      size_bytes: file.size,
      storage_path: path,
      mime_type: file.type || null,
      uploaded_by: uploadedBy || admin?.id || null,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    revalidatePath("/");
    revalidatePath("/admin");
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
