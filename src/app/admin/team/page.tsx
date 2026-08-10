import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/shell";
import { AdminTeamPanel } from "@/components/admin/team-panel";
import { getBannerMessage, getCurrentAdmin, getPeople, getRoleOptions } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AdminTeamPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  const [people, bannerMessage, roleOptions] = await Promise.all([
    getPeople(),
    getBannerMessage(),
    getRoleOptions(),
  ]);

  return (
    <AdminShell active="team">
      <AdminTeamPanel
        people={people}
        me={admin}
        bannerMessage={bannerMessage}
        roleOptions={roleOptions}
      />
    </AdminShell>
  );
}
