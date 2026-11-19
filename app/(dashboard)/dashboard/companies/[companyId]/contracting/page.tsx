"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { FinanceMetric, FinanceEmpty, financePrimary, financeOutline } from "@/components/finance/workspace";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { useLocale } from "@/components/providers/locale-provider";

type Project = { id: string; code: string; name: string; clientName: string; location?: string; managerName?: string; budget: string; status: string; startDate: string; endDate?: string };
type Contract = { id: string; number: string; kind: string; partyName: string; value: string; retentionPercent: string; advanceRecoveryPercent: string; balances: { claimed: string; retained: string; advance: string; payable: string; settled: string } };
type Document = { id: string; kind: string; status: string; date: string; reference: string; description: string; amount: string; retention: string; advanceRecovery: string; netAmount: string; contract?: { partyName: string }; journalEntry?: { id: string; number: string; status: string; isDeleted: boolean; isReversed: boolean } };
type DailyLog = { id: string; date: string; description: string; workersCount: number; progressPercent: string };
type Data = { projects: Project[]; project: Project | null; contracts: Contract[]; documents: Document[]; dailyLogs: DailyLog[]; cashAccounts: { id: string; code: string; nameAr: string }[]; permissions: Record<string, boolean>; total: number; page: number; report?: { revenue: string; costs: string; margin: string } };
type Field = { name: string; label: string; type?: string; required?: boolean; value?: string; options?: [string, string][]; step?: string; max?: string };
const today = () => new Date().toLocaleDateString("en-CA");
const money = (value: string | number) => Number(value).toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

function EntryForm({ fields, submit, busy, title }: { fields: Field[]; submit: (data: Record<string, string>) => Promise<boolean>; busy: boolean; title: string }) {
  return <form className="section-card space-y-4 no-print" onSubmit={async e => {
    e.preventDefault(); const form = e.currentTarget;
    const values = Object.fromEntries([...new FormData(form).entries()].map(([k, v]) => [k, String(v)]));
    if (await submit(values)) form.reset();
  }}>
    <h3 className="font-bold">{title}</h3>
    <fieldset disabled={busy} className="grid gap-4 md:grid-cols-2">
      {fields.map(field => <label key={field.name} className={field.type === "textarea" ? "md:col-span-2" : ""}>
        <span className="form-label">{field.label}{field.required !== false ? " *" : ""}</span>
        {field.options ? <select name={field.name} defaultValue={field.value ?? ""} required={field.required !== false} className="input-field"><option value="">—</option>{field.options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          : field.type === "textarea" ? <textarea name={field.name} required={field.required !== false} maxLength={3000} className="input-field" rows={3} />
          : <input name={field.name} type={field.type ?? "text"} required={field.required !== false} defaultValue={field.value} min={field.type === "number" ? "0" : undefined} max={field.max} step={field.step ?? (field.type === "number" ? "0.001" : undefined)} maxLength={field.type ? undefined : 180} className="input-field" />}
      </label>)}
      <div className="md:col-span-2"><button className={financePrimary} type="submit">{busy ? "…" : title}</button></div>
    </fieldset>
  </form>;
}

export default function ContractingPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const en = useLocale().locale === "en";
  const t = (ar: string, english: string) => en ? english : ar;
  const [data, setData] = useState<Data | null>(null);
  const [projectId, setProjectId] = useState("");
  const [month, setMonth] = useState("");
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState("contracts");
  const [kind, setKind] = useState("CLAIM");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const endpoint = `/api/companies/${companyId}/contracting`;
  const reload = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ projectId, month, page: String(page) });
      const r = await fetch(`${endpoint}?${query}`, { signal }); const body = await r.json();
      if (!r.ok || !body.success) throw new Error(body.error || "Failed to load projects");
      setData(body.data);
    } catch (error) { if (!signal?.aborted) setData(null); throw error; }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [endpoint, projectId, month, page]);
  useEffect(() => { const controller = new AbortController(); setError(""); reload(controller.signal).catch(e => { if (!controller.signal.aborted) setError(e.message); }); return () => controller.abort(); }, [reload]);
  async function save(action: string, values: Record<string, string>) {
    setBusy(true); setError(""); setSuccess("");
    try {
      const r = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, projectId: data?.project?.id, ...values }) });
      const body = await r.json(); if (!r.ok || !body.success) throw new Error(body.error || "Failed to save");
      await reload();
      if (action === "project") { setProjectId(body.data.id); setPage(1); }
      setSuccess(t("تم الحفظ بنجاح", "Saved successfully")); return true;
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to save"); return false; }
    finally { setBusy(false); }
  }
  const labels: Record<string, string> = {
    CLAIM: t("مستخلص أعمال", "Work certificate"), COST: t("تكلفة مباشرة مدفوعة", "Paid direct cost"), ADVANCE: t("دفعة مقدمة", "Advance"), SETTLEMENT: t("تحصيل / سداد مستحق", "Settlement"), RETENTION_RELEASE: t("تحصيل / صرف محتجز", "Retention payment"),
    ACTIVE: t("نشط", "Active"), ON_HOLD: t("متوقف", "On hold"), COMPLETED: t("مكتمل", "Completed"), DRAFT: t("مسودة", "Draft"), APPROVED: t("معتمد", "Approved"), VOID: t("ملغي", "Voided"), POSTED: t("مرحل", "Posted"), REJECTED: t("مرفوض", "Rejected"), CANCELLED: t("ملغي", "Cancelled"), PENDING_APPROVAL: t("بانتظار الاعتماد", "Pending approval"),
  };
  const project = data?.project;
  const active = project?.status === "ACTIVE";
  const dateField: Field = { name: "date", label: t("التاريخ", "Date"), type: "date", value: today() };
  const tabs = [["contracts", t("العقود", "Contracts")], ["documents", t("المستخلصات والحركات", "Certificates & movements")], ["site", t("سجل الموقع", "Site log")], ["report", t("تقرير المشروع", "Project report")]];
  return <div className="finance-workspace">
    <Header title={t("مشروعات المقاولات", "Contracting projects")} subtitle={t("تشغيل المواقع ومتابعة العقود والتكاليف", "Site operations, contracts and costs")} companyId={companyId} />
    <div className="page-container space-y-5">
      <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-5 no-print space-y-2 text-sm leading-7">
        <p>{t("ابدأ بمشروع، ثم أضف عقد العميل وعقود مقاولي الباطن. سجّل الأعمال المنفذة في المستخلص، والمصروفات المباشرة في التكاليف، والتقدم اليومي في سجل الموقع.", "Create a project, then customer and subcontractor contracts. Record completed work as certificates, paid direct costs as costs, and daily progress in site logs.")}</p>
        <p>{t("اعتماد الحركة ينشئ قيدًا مسودة للمحاسب. التقارير المالية تعتمد القيود المرحلة فقط؛ نسبة الإنجاز بالموقع لا تُرحّل إيرادًا تلقائيًا.", "Approving a movement creates a draft journal for accounting review. Financial reports use posted entries only; site progress does not automatically recognize revenue.")}</p>
        <Link className="text-primary underline" href={`/dashboard/companies/${companyId}/accounting/accounts`}>{t("دليل الحسابات", "Chart of accounts")}</Link>
      </div>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
      {success && <p role="status" className="no-print rounded-lg bg-green-50 p-3 text-green-700">{success}</p>}
      {data?.permissions.CREATE && <details className="no-print"><summary className={`${financeOutline} cursor-pointer`}>{t("إضافة مشروع", "Add project")}</summary><EntryForm title={t("حفظ المشروع", "Save project")} busy={busy} submit={v => save("project", v)} fields={[
        { name: "code", label: t("كود المشروع", "Project code") }, { name: "name", label: t("اسم المشروع", "Project name") }, { name: "clientName", label: t("اسم العميل", "Customer") }, { name: "location", label: t("الموقع", "Location"), required: false }, { name: "managerName", label: t("مدير الموقع", "Site manager"), required: false }, { name: "budget", label: t("ميزانية التكاليف (د.ك)", "Cost budget (KWD)"), type: "number", value: "0" }, { name: "startDate", label: t("تاريخ البداية", "Start date"), type: "date", value: today() }, { name: "endDate", label: t("تاريخ النهاية المتوقع", "Expected end date"), type: "date", required: false },
      ]} /></details>}
      <div className="section-card no-print flex flex-wrap items-end gap-4">
        <label className="min-w-64 flex-1"><span className="form-label">{t("المشروع", "Project")}</span><select className="input-field" value={projectId || project?.id || ""} onChange={e => { setProjectId(e.target.value); setPage(1); setSuccess(""); }}><option value="">—</option>{data?.projects.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}</select></label>
        <label><span className="form-label">{t("شهر الحركات والتقرير", "Report month")}</span><input type="month" className="input-field" value={month} onChange={e => { setMonth(e.target.value); setPage(1); }} /></label>
        {month && <button className={financeOutline} onClick={() => { setMonth(""); setPage(1); }}>{t("كل الفترات", "All periods")}</button>}
      </div>
      {loading && <p>{t("جار التحميل...", "Loading…")}</p>}
      {!loading && data && !project && <p className="section-card">{t("لا توجد مشروعات بعد. أضف أول مشروع للبدء.", "No projects yet. Add your first project to begin.")}</p>}
      {!loading && project && <>
        <div className="section-card border-s-4 border-s-primary flex flex-wrap items-center justify-between gap-4">
          <div><h2 className="text-xl font-bold">{project.code} — {project.name}</h2><p className="mt-2 text-sm text-muted-foreground">{[project.clientName, project.location, project.managerName].filter(Boolean).join(" · ")}</p><p className="text-sm">{project.startDate.slice(0, 10)} — {project.endDate?.slice(0, 10) ?? "—"} · {labels[project.status]}</p></div>
          {data?.permissions.UPDATE && <select aria-label={t("حالة المشروع", "Project status")} disabled={busy} value={project.status} className="input-field no-print w-auto" onChange={e => save("projectStatus", { status: e.target.value })}>{["ACTIVE", "ON_HOLD", "COMPLETED"].map(s => <option key={s} value={s}>{labels[s]}</option>)}</select>}
        </div>
        <div className="no-print flex flex-wrap gap-2 rounded-xl border bg-card p-2">{tabs.map(([id, label]) => <button key={id} className={tab === id ? financePrimary : financeOutline} onClick={() => setTab(id)}>{label}</button>)}</div>
        {data?.permissions.UPDATE && tab === "contracts" && <details className="no-print"><summary className={`${financeOutline} cursor-pointer`}>{t("تعديل بيانات المشروع", "Edit project details")}</summary><EntryForm key={project.id} title={t("حفظ بيانات المشروع", "Save project details")} busy={busy} submit={v => save("projectUpdate", v)} fields={[
          { name: "name", label: t("اسم المشروع", "Project name"), value: project.name }, { name: "location", label: t("الموقع", "Location"), value: project.location ?? "", required: false }, { name: "managerName", label: t("مدير الموقع", "Site manager"), value: project.managerName ?? "", required: false }, { name: "budget", label: t("ميزانية التكاليف", "Cost budget"), type: "number", value: project.budget },
        ]} /></details>}
        {tab === "contracts" && <>
          {active && data?.permissions.CREATE && <details><summary className={`${financeOutline} cursor-pointer`}>{t("إضافة عقد", "Add contract")}</summary><EntryForm title={t("حفظ العقد", "Save contract")} busy={busy} submit={v => save("contract", v)} fields={[
            { name: "number", label: t("رقم العقد", "Contract number") }, { name: "kind", label: t("نوع العقد", "Contract type"), options: [["CUSTOMER", t("عقد عميل", "Customer")], ["SUBCONTRACTOR", t("مقاول باطن", "Subcontractor")]] }, { name: "partyName", label: t("اسم الطرف", "Party name") }, { name: "value", label: t("قيمة العقد (د.ك)", "Contract value (KWD)"), type: "number" }, { name: "retentionPercent", label: t("نسبة التأمين المحتجز %", "Retention %"), type: "number", step: "0.01", max: "100", value: "0" }, { name: "advanceRecoveryPercent", label: t("نسبة استرداد المقدم من كل مستخلص %", "Advance recovery per certificate %"), type: "number", step: "0.01", max: "100", value: "0" }, { name: "description", label: t("وصف نطاق الأعمال", "Scope of work"), type: "textarea", required: false },
          ]} /></details>}
          <p className="text-sm text-muted-foreground">{t("أرصدة العقود تراكمية لكل الفترات وتشمل الحركات المعتمدة التي ما زالت قيودها مسودة أو مرحلة. القيم الافتراضية للنسب صفر؛ اضبطها طبقًا للعقد الموقع.", "Contract balances cover all periods and include approved movements with draft or posted journals. Default percentages are zero; set them according to the signed contract.")}</p>
          {active && data?.permissions.UPDATE && !!data.contracts.length && <details className="no-print"><summary className={`${financeOutline} cursor-pointer`}>{t("تعديل قيمة عقد / أمر تغييري", "Revise contract value / variation")}</summary><EntryForm title={t("حفظ تعديل قيمة العقد", "Save contract revision")} busy={busy} submit={v => save("contractUpdate", v)} fields={[
            { name: "contractId", label: t("العقد", "Contract"), options: data.contracts.map(c => [c.id, `${c.number} — ${c.partyName}`]) }, { name: "value", label: t("القيمة الإجمالية الجديدة للعقد", "New total contract value"), type: "number" }, { name: "reason", label: t("سبب التعديل ومرجع الموافقة", "Reason and approval reference"), type: "textarea" },
          ]} /></details>}
          <div className="section-card overflow-x-auto"><table className="ar-table"><thead><tr>{[t("العقد / الطرف", "Contract / party"), t("القيمة", "Value"), t("المستخلصات", "Certificates"), t("المحتجز", "Retention"), t("المقدم المتبقي", "Advance balance"), t("صافي المستحق", "Net due")].map(x => <th key={x}>{x}</th>)}</tr></thead><tbody>{data?.contracts.map(c => <tr key={c.id}><td>{c.number} — {c.partyName}<p className="text-xs">{c.kind === "CUSTOMER" ? t("عميل", "Customer") : t("مقاول باطن", "Subcontractor")} · {t("محتجز", "Retention")} {c.retentionPercent}% · {t("استرداد", "Recovery")} {c.advanceRecoveryPercent}%</p></td>{[c.value, c.balances.claimed, c.balances.retained, c.balances.advance, c.balances.payable].map((v, i) => <td key={i} dir="ltr">{money(v)}</td>)}</tr>)}</tbody></table>{!data?.contracts.length && <FinanceEmpty title={t("لا توجد عقود", "No contracts")} />}</div>
        </>}
        {tab === "documents" && <>
          {active && data?.permissions.CREATE && <details className="no-print"><summary className={`${financeOutline} cursor-pointer`}>{t("إضافة حركة", "Add movement")}</summary><label className="block my-3"><span className="form-label">{t("نوع الحركة", "Movement type")}</span><select className="input-field" value={kind} onChange={e => setKind(e.target.value)}>{["CLAIM", "COST", "ADVANCE", "SETTLEMENT", "RETENTION_RELEASE"].map(k => <option key={k} value={k}>{labels[k]}</option>)}</select></label>
            <p className="text-sm mb-3">{t("أدخل قيمة الأعمال الحالية فقط في المستخلص، وليس الإجمالي التراكمي. الدفعات والمحتجزات تعني تحصيلًا من العميل أو صرفًا لمقاول الباطن بحسب العقد.", "Enter current work value, not cumulative value. Payments mean receipts from customers or payments to subcontractors according to the selected contract.")}</p>
            <EntryForm key={`${kind}:${project.id}`} title={t("حفظ مسودة الحركة", "Save draft movement")} busy={busy} submit={v => save("document", { ...v, kind })} fields={[
              ...(kind !== "COST" ? [{ name: "contractId", label: t("العقد", "Contract"), options: data!.contracts.map(c => [c.id, `${c.number} — ${c.partyName}`] as [string, string]) }] : [{ name: "category", label: t("نوع التكلفة", "Cost category"), options: [["MATERIAL", t("مواد", "Materials")], ["LABOUR", t("عمالة", "Labour")], ["EQUIPMENT", t("معدات وإيجارات", "Equipment and rental")], ["OTHER", t("أخرى", "Other")]] as [string, string][] }]),
              dateField, { name: "reference", label: t("رقم المستند / المرجع الفريد", "Unique document reference") }, { name: "amount", label: t("القيمة (د.ك)", "Amount (KWD)"), type: "number" },
              ...(kind !== "CLAIM" ? [{ name: "cashAccountId", label: t("حساب الصندوق / البنك", "Cash / bank account"), options: data!.cashAccounts.map(a => [a.id, `${a.code} — ${a.nameAr}`] as [string, string]) }] : []),
              { name: "description", label: t("بيان الأعمال / الحركة", "Work / movement description"), type: "textarea" },
            ]} />
          </details>}
          <div className="section-card overflow-x-auto"><table className="ar-table"><thead><tr>{[t("التاريخ / المرجع", "Date / reference"), t("البيان", "Description"), t("القيمة", "Gross"), t("المحتجز", "Retention"), t("استرداد المقدم", "Advance recovery"), t("الصافي", "Net"), t("الحالة / القيد", "Status / journal"), t("إجراءات", "Actions")].map(x => <th key={x}>{x}</th>)}</tr></thead><tbody>{data?.documents.map(d => <tr key={d.id}><td>{d.date.slice(0, 10)}<p>{d.reference}</p></td><td>{labels[d.kind]} — {d.contract?.partyName}<p>{d.description}</p></td>{[d.amount, d.retention, d.advanceRecovery, d.netAmount].map((v, i) => <td key={i} dir="ltr">{money(v)}</td>)}<td><span className={d.status === "APPROVED" ? "status-approved" : d.status === "VOID" ? "status-cancelled" : "status-draft"}>{labels[d.status]}</span>{d.journalEntry && <p><Link className="text-primary underline" href={`/dashboard/companies/${companyId}/accounting/journal-entries/${d.journalEntry.id}`}>{d.journalEntry.number}</Link> · {d.journalEntry.isDeleted || d.journalEntry.isReversed ? t("محذوف / معكوس", "Deleted / reversed") : labels[d.journalEntry.status]}</p>}</td><td><Link className="text-primary underline no-print" target="_blank" href={`/dashboard/companies/${companyId}/contracting/documents/${d.id}/print`}>{t("\u0637\u0628\u0627\u0639\u0629", "Print")}</Link>{d.status === "DRAFT" && <div className="flex gap-2 no-print">{active && data.permissions.APPROVE && <button disabled={busy} className={financeOutline} onClick={() => save("approve", { documentId: d.id })}>{t("اعتماد وإنشاء قيد", "Approve & create journal")}</button>}{data.permissions.DELETE && <button disabled={busy} className="text-red-600" onClick={() => save("void", { documentId: d.id })}>{t("إلغاء", "Void")}</button>}</div>}</td></tr>)}</tbody></table>{!data?.documents.length && <FinanceEmpty title={t("لا توجد حركات للفترة المختارة", "No movements for this period")} />}</div>
          <div className="no-print flex justify-center items-center gap-3"><button className={financeOutline} disabled={page <= 1 || loading} onClick={() => setPage(Math.max(1, (data?.page ?? page) - 1))}>{t("السابق", "Previous")}</button><span>{data?.page} / {Math.max(1, Math.ceil((data?.total ?? 0) / 30))}</span><button className={financeOutline} disabled={(data?.page ?? page) * 30 >= (data?.total ?? 0) || loading} onClick={() => setPage((data?.page ?? page) + 1)}>{t("التالي", "Next")}</button></div>
        </>}
        {tab === "site" && <>
          {active && data?.permissions.CREATE && <EntryForm title={t("تسجيل شغل الموقع", "Record site work")} busy={busy} submit={v => save("dailyLog", v)} fields={[dateField, { name: "workersCount", label: t("عدد العمال", "Workers count"), type: "number", step: "1", value: "0" }, { name: "progressPercent", label: t("نسبة الإنجاز الإجمالية بالموقع %", "Overall site progress %"), type: "number", step: "0.01", max: "100", value: "0" }, { name: "description", label: t("الأعمال المنفذة والملاحظات والمعوقات", "Completed work, notes and obstacles"), type: "textarea" }]} />}
          <div className="section-card"><h3 className="font-bold mb-3">{t("آخر 60 تسجيلًا للفترة", "Latest 60 logs in period")}</h3>{data?.dailyLogs.map(log => <div key={log.id} className="border-b py-3"><strong>{log.date.slice(0, 10)} · {log.progressPercent}% · {log.workersCount} {t("عامل", "workers")}</strong><p className="whitespace-pre-wrap">{log.description}</p></div>)}{!data?.dailyLogs.length && <FinanceEmpty title={t("لا توجد تسجيلات", "No site logs")} />}</div>
        </>}
        {tab === "report" && <div className="finance-document space-y-6">
          <h3 className="border-b-2 border-blue-900 pb-4 text-xl font-bold">{t("تقرير المشروع المالي", "Project financial report")} — {month || t("كل الفترات", "All periods")}</h3>
          <p className="text-sm text-muted-foreground">{t("الأرقام التالية من القيود المرحلة فقط. الميزانية تخص كامل المشروع.", "The following figures use posted journals only. The budget covers the whole project.")}</p>
          <div className="grid gap-3 md:grid-cols-4">{[[t("ميزانية التكلفة", "Cost budget"), project.budget], [t("الإيراد المرحل", "Posted revenue"), data?.report?.revenue ?? "0"], [t("التكاليف المرحلة", "Posted costs"), data?.report?.costs ?? "0"], [t("النتيجة المالية للفترة", "Period financial result"), data?.report?.margin ?? "0"]].map(([label, value]) => <FinanceMetric key={label} label={label} value={`${money(value)} KWD`} tone="blue" />)}</div>
          <div className="no-print flex gap-3"><button className={financeOutline} onClick={() => window.print()}>{t("طباعة / PDF", "Print / PDF")}</button><Link className={financeOutline} href={`/dashboard/companies/${companyId}/accounting/journal-entries`}>{t("مراجعة القيود وترحيلها", "Review and post journals")}</Link></div>
        </div>}
      </>}
    </div>
  </div>;
}
