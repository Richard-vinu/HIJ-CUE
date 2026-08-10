import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/data";
import { AdminLoginForm } from "@/components/admin/login-form";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  const admin = await getCurrentAdmin();
  if (admin) redirect("/admin");

  return <AdminLoginForm />;
}
