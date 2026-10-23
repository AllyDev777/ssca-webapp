import { AppShell } from "@/components/AppShell";
import { requireAdmin } from "@/lib/auth";

// Real admin check (middleware only gates on the signed cookie hint).
export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const admin = await requireAdmin();
  return <AppShell user={admin}>{children}</AppShell>;
}
