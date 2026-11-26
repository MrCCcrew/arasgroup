import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { canAccessCompany, hasPermission } from "@/lib/auth/permissions";
import { getLocale } from "@/lib/i18n";
import { FinancePrintToolbar } from "@/components/finance/print-toolbar";

export default async function ConstructionDocumentPrint({ params }: { params: Promise<{ companyId: string; documentId: string }> }) {
  const { companyId, documentId } = await params;
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canAccessCompany(session, companyId) || !(hasPermission(session, "ACCOUNTING", "VIEW", { companyId }) || hasPermission(session, "CONTRACTING", "VIEW", { companyId }))) notFound();
  const row = await prisma.constructionDocument.findFirst({ where: { id: documentId, project: { companyId, company: { type: "CONTRACTING" } } }, include: { project: { include: { company: { select: { nameAr: true, nameEn: true, logoUrl: true } } } }, contract: true, journalEntry: { select: { number: true, status: true, isDeleted: true, isReversed: true } } } });
  if (!row) notFound();
  const en = (await getLocale()) === "en";
  const t = (ar: string, english: string) => en ? english : ar;
  const title = ({ CLAIM: t("مستخلص أعمال", "Work certificate"), COST: t("تكلفة مشروع مدفوعة", "Paid project cost"), ADVANCE: t("دفعة مقدمة", "Advance"), SETTLEMENT: t("سداد / تحصيل مستحق", "Settlement"), RETENTION_RELEASE: t("صرف / تحصيل محتجز", "Retention payment") } as Record<string, string>)[row.kind];
  return <main className="construction-print mx-auto max-w-4xl p-4 md:p-8" dir={en ? "ltr" : "rtl"}>
    <style>{`@media print { @page construction { size: A4 portrait; margin: 15mm; } .construction-print { page: construction; padding: 0; } .construction-print tr { break-inside: avoid; } }`}</style>
    <FinancePrintToolbar en={en} backHref={`/dashboard/companies/${companyId}/contracting`} /><article className="finance-document">
    <header className="mb-6 flex items-center justify-between gap-4 border-b-2 pb-4">
      <div><h1 className="text-2xl font-bold">{en ? row.project.company.nameEn || row.project.company.nameAr : row.project.company.nameAr}</h1><h2 className="mt-2 text-lg text-blue-800">{title}</h2></div>
      {row.project.company.logoUrl && <img src={row.project.company.logoUrl} alt="" className="h-24 w-36 object-contain" />}
    </header>
    <div className="mb-5 space-y-2"><p>{t("المشروع", "Project")}: {row.project.code} — {row.project.name}</p><p>{t("التاريخ", "Date")}: {row.date.toISOString().slice(0, 10)} · {t("المرجع", "Reference")}: {row.reference}</p>{row.contract && <p>{t("العقد / الطرف", "Contract / party")}: {row.contract.number} — {row.contract.partyName}</p>}<p className="font-bold">{row.status === "DRAFT" ? t("مسودة — غير معتمدة", "Draft — not approved") : row.status === "VOID" ? t("ملغي", "Voided") : t("حركة معتمدة", "Approved movement")}</p>{row.journalEntry && <p>{t("القيد المحاسبي", "Journal")}: {row.journalEntry.number} — {row.journalEntry.isDeleted || row.journalEntry.isReversed ? t("محذوف / معكوس", "Deleted / reversed") : row.journalEntry.status === "POSTED" ? t("مرحل", "Posted") : t("لم يرحّل بعد", "Not yet posted")}</p>}</div>
    <p className="mb-6 whitespace-pre-wrap border p-4">{row.description}</p>
    <table className="w-full border-collapse"><tbody>{[[t("قيمة الأعمال / الحركة", "Gross amount"), row.amount], [t("التأمين المحتجز", "Retention"), row.retention], [t("استرداد الدفعة المقدمة", "Advance recovery"), row.advanceRecovery], [t("صافي المستحق", "Net amount"), row.netAmount]].map(([label, value], i) => <tr key={i}><th className="border p-3 text-start">{String(label)}</th><td className="border p-3" dir="ltr">{Number(value).toFixed(3)} KWD</td></tr>)}</tbody></table>
    <div className="mt-16 grid grid-cols-3 gap-6 text-center">{[t("إعداد الموقع", "Prepared by site"), t("المراجعة المالية", "Accounting review"), t("اعتماد الطرف المختص", "Authorized approval")].map(label => <div key={label} className="border-t pt-4">{label}</div>)}</div>
  </article></main>;
}
