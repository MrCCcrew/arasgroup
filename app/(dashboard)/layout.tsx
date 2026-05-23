import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

// This is just a route group layout — auth is enforced per nested layout
export default async function DashboardGroupLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  return <>{children}</>;
}
