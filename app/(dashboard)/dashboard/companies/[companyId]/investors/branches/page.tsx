import Link from "next/link";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { Building2, FileText } from "lucide-react";

interface Props {
  params: Promise<{ companyId: string }>;
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE:    "فعال",
  EXPIRED:   "منتهي",
  SUSPENDED: "موقوف",
  CANCELLED: "ملغاة",
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:    "bg-emerald-100 text-emerald-700",
  EXPIRED:   "bg-red-100 text-red-700",
  SUSPENDED: "bg-orange-100 text-orange-700",
  CANCELLED: "bg-rose-100 text-rose-700",
};

export default async function InvestorBranchesPage({ params }: Props) {
  const { companyId } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const locale = await getLocale();

  // جلب كل التراخيص مرة واحدة
  const allLicenses = await prisma.license.findMany({
    where: { companyId, status: { not: "CANCELLED" } },
    include: {
      investor: { select: { nameAr: true, nameEn: true } },
      branch:   { select: { nameAr: true } },
    },
    orderBy: [{ isMainLicense: "desc" }, { commercialNameAr: "asc" }],
  });

  const mainLicenses = allLicenses.filter((l) => l.isMainLicense);
  const subLicenses  = allLicenses.filter((l) => !l.isMainLicense);

  // فهرسة التراخيص الفرعية حسب mainLicenseId
  const subsByMain = new Map<string, typeof subLicenses>();
  for (const sub of subLicenses) {
    const key = sub.mainLicenseId ?? "__orphan__";
    if (!subsByMain.has(key)) subsByMain.set(key, []);
    subsByMain.get(key)!.push(sub);
  }

  // الفرعية التي ليس لها ترخيص رئيسي
  const orphans = subsByMain.get("__orphan__") ?? [];

  function fmt(d: Date | null | undefined) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("ar-KW");
  }

  function daysLeft(d: Date | null | undefined): number | null {
    if (!d) return null;
    return Math.floor((new Date(d).getTime() - Date.now()) / 86400000);
  }

  function ExpiryText({ date }: { date: Date | null | undefined }) {
    if (!date) return <span className="text-muted-foreground text-sm">—</span>;
    const days = daysLeft(date);
    const label = fmt(date);
    if (days === null) return <span>{label}</span>;
    if (days < 0)    return <span className="text-red-600 font-semibold text-sm">{label}</span>;
    if (days <= 30)  return <span className="text-red-500 text-sm">{label} <span className="text-xs">({days})</span></span>;
    if (days <= 90)  return <span className="text-orange-500 text-sm">{label}</span>;
    return <span className="text-sm">{label}</span>;
  }

  function SubLicenseTable({ subs }: { subs: typeof subLicenses }) {
    if (subs.length === 0) return null;
    return (
      <div className="overflow-x-auto">
        <table className="ar-table">
          <thead>
            <tr>
              <th>الاسم التجاري</th>
              <th>رقم الترخيص</th>
              <th>المسئول</th>
              <th>الفرع</th>
              <th>انتهاء الترخيص</th>
              <th>الحالة</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {subs.map((sub) => (
              <tr key={sub.id} className="hover:bg-muted/30">
                <td className="font-medium">{sub.commercialNameAr}</td>
                <td className="font-mono text-sm" dir="ltr">{sub.licenseNumber}</td>
                <td className="text-sm">{sub.investor?.nameAr ?? <span className="text-muted-foreground">—</span>}</td>
                <td className="text-sm">{sub.branch?.nameAr ?? <span className="text-muted-foreground">—</span>}</td>
                <td><ExpiryText date={sub.licenseExpiryDate} /></td>
                <td>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[sub.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {STATUS_LABELS[sub.status] ?? sub.status}
                  </span>
                </td>
                <td>
                  <Link
                    href={`/dashboard/companies/${companyId}/licenses/${sub.id}`}
                    className="text-xs text-primary hover:underline"
                  >
                    تفاصيل
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const totalSubs = subLicenses.length;

  return (
    <div>
      <Header
        title={locale === "en" ? "Sub-Licenses" : "التراخيص الفرعية"}
        subtitle={locale === "en"
          ? `${totalSubs} sub-license(s) across ${mainLicenses.length} main license(s)`
          : `${totalSubs} ترخيص فرعي تابع لـ ${mainLicenses.length} ترخيص رئيسي`}
        companyId={companyId}
        actions={
          <Link
            href={`/dashboard/companies/${companyId}/licenses`}
            className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            <FileText size={15} />
            {locale === "en" ? "All licenses" : "كل التراخيص"}
          </Link>
        }
      />

      <div className="page-container space-y-6">

        {totalSubs === 0 ? (
          <div className="section-card py-16 text-center text-muted-foreground">
            <FileText size={32} className="mx-auto mb-3 opacity-30" />
            <p>{locale === "en" ? "No sub-licenses found" : "لا توجد تراخيص فرعية — أضف تراخيص فرعية من صفحة التراخيص"}</p>
            <Link
              href={`/dashboard/companies/${companyId}/licenses`}
              className="mt-3 inline-block text-sm text-primary hover:underline"
            >
              {locale === "en" ? "Go to licenses" : "الذهاب لصفحة التراخيص"}
            </Link>
          </div>
        ) : (
          <>
            {/* مجمّعة حسب الترخيص الرئيسي */}
            {mainLicenses.map((main) => {
              const subs = subsByMain.get(main.id) ?? [];
              if (subs.length === 0) return null;
              return (
                <div key={main.id} className="section-card">
                  {/* رأس الترخيص الرئيسي */}
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 size={16} className="text-blue-500 shrink-0" />
                      <div>
                        <Link
                          href={`/dashboard/companies/${companyId}/licenses/${main.id}`}
                          className="font-bold text-blue-700 hover:underline"
                        >
                          {main.commercialNameAr}
                        </Link>
                        <p className="text-xs text-muted-foreground font-mono" dir="ltr">{main.licenseNumber}</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700 font-medium">
                      {subs.length} {locale === "en" ? "sub-license(s)" : "فرعي"}
                    </span>
                  </div>

                  <SubLicenseTable subs={subs} />
                </div>
              );
            })}

            {/* فرعية بلا ترخيص رئيسي */}
            {orphans.length > 0 && (
              <div className="section-card border-dashed">
                <div className="mb-4 flex items-center gap-2">
                  <Building2 size={16} className="text-orange-400 shrink-0" />
                  <p className="font-semibold text-orange-600">
                    {locale === "en" ? "Sub-licenses without a main license" : "تراخيص فرعية بدون ترخيص رئيسي"} ({orphans.length})
                  </p>
                </div>
                <SubLicenseTable subs={orphans} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
