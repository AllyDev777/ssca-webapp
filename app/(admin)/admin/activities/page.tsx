import type { Metadata } from "next";
import { AdminNav } from "@/components/AdminNav";
import { LargeTitle } from "@/components/LargeTitle";
import { listActivities } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth";
import { ActivitiesManager } from "./ActivitiesManager";

export const metadata: Metadata = { title: "Activities" };

export default async function ActivitiesPage() {
  await requireAdmin();
  const activities = await listActivities();
  const max = activities.filter((a) => a.isActive).reduce((sum, a) => sum + a.points, 0);

  return (
    <main className="page">
      <LargeTitle title="Activities" subtitle={`Weekly maximum: ${max} pts`} />
      <AdminNav current="activities" />
      <ActivitiesManager activities={activities} />
    </main>
  );
}
