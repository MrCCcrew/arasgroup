import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { Header } from "@/components/layout/header";
import { ImportExportManager } from "@/components/import-export/import-export-manager";

interface Props { params: Promise<{ companyId: string }> }

export default async function ImportExportPage({ params }: Props) {
  const { companyId } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div>
      <Header
        title="استيراد وتصدير البيانات"
        subtitle="رفع وتحميل بيانات الموظفين والمركبات والمسئولين بصيغة Excel"
        companyId={companyId}
      />
      <div className="page-container">
        <ImportExportManager companyId={companyId} />
      </div>
    </div>
  );
}
