import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/shell";
import { AdminTeamPanel } from "@/components/admin/team-panel";
import { getCurrentAdmin, getPeople } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AdminTeamPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  const people = await getPeople();

  return (
    <AdminShell active="team">
      <AdminTeamPanel people={people} meId={admin.id} />
    </AdminShell>
  );
}
