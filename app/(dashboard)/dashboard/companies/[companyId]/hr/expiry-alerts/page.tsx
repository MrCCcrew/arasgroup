import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n";
import { ExpiryAlertsClient } from "./client";
import { getExpiryAlertsData } from "./data";

interface Props {
  params: Promise<{ companyId: string }>;
}

export default async function ExpiryAlertsPage({ params }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { companyId } = await params;
  const locale = await getLocale();
  const numberLocale = locale === "en" ? "en-US" : "ar-KW";
  const alerts = await getExpiryAlertsData(session, companyId);

  return (
    <div>
      <Header
        title="تنبيهات الانتهاء"
        subtitle="كل ما سينتهي قريبًا للموظفين والمركبات والتراخيص بحسب صلاحياتك"
        companyId={companyId}
      />
      <ExpiryAlertsClient alerts={alerts} companyId={companyId} numberLocale={numberLocale} />
    </div>
  );
}
