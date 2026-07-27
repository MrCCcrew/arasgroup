import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";

export default async function RootPage() {
  const session = await getSession();
  if (session) {
    redirect(session.accountType === "OWNER_MANAGED_PARTNER" ? "/partner" : "/dashboard");
  } else {
    redirect("/login");
  }
}
