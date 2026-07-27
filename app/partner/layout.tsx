import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";

export default async function PartnerLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.accountType !== "OWNER_MANAGED_PARTNER") redirect("/dashboard");
  return <>{children}</>;
}
