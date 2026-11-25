"use client";

import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Camera, FileText, Landmark, Receipt, Upload } from "lucide-react";
import { Header } from "@/components/layout/header";
import { fileDragProps } from "@/components/files/drag-file";

type Project = { id: string; code: string; name: string };
type Submission = { id: string; originalName: string; filePath: string; fileType: string; notes: string | null; attachmentType: string; createdAt: string; projectName: string; uploadedBy: { nameAr: string }; mine: boolean };

export default function ContractingSubmissionsPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const [projects, setProjects] = useState<Project[]>([]); const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [projectId, setProjectId] = useState(""); const [kind, setKind] = useState<"INVOICE" | "DEPOSIT_RECEIPT">("INVOICE"); const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true); const [uploading, setUploading] = useState(false); const [message, setMessage] = useState(""); const fileRef = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => { const response = await fetch(`/api/companies/${companyId}/contracting/submissions`); const body = await response.json(); if (!response.ok || !body.success) throw new Error(body.error || "تعذر تحميل المشروعات"); setProjects(body.data.projects); setSubmissions(body.data.submissions); }, [companyId]);
  useEffect(() => { load().catch(error => setMessage(error.message)).finally(() => setLoading(false)); }, [load]);
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    if (!projectId) { setMessage("اختر اسم المشروع أولاً"); event.target.value = ""; return; }
    setUploading(true); setMessage("");
    try { const form = new FormData(); form.set("file", file); form.set("projectId", projectId); form.set("kind", kind); form.set("notes", notes); const response = await fetch(`/api/companies/${companyId}/contracting/submissions`, { method: "POST", body: form }); const body = await response.json(); if (!response.ok || !body.success) throw new Error(body.error || "تعذر رفع المستند"); setNotes(""); await load(); setMessage("تم رفع المستند بنجاح وهو جاهز للمراجعة."); } catch (error) { setMessage(error instanceof Error ? error.message : "تعذر رفع المستند"); } finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  }
  return <div><Header companyId={companyId} title="رفع فواتير وإيصالات المشاريع" subtitle="اختر المشروع ثم ارفع الفاتورة أو إيصال الإيداع من الهاتف أو الكمبيوتر." />
    <main className="page-container mx-auto max-w-5xl space-y-5">
      <section className="section-card space-y-5"><div className="flex items-center gap-3"><span className="rounded-xl bg-orange-100 p-3 text-orange-700"><Upload size={22} /></span><div><h2 className="font-bold">مستند جديد</h2><p className="text-sm text-muted-foreground">PDF أو صورة حتى 10 ميجابايت</p></div></div>
        <div className="grid gap-4 sm:grid-cols-2"><label><span className="form-label">المشروع *</span><select value={projectId} onChange={event => setProjectId(event.target.value)} className="input-field"><option value="">اختر المشروع</option>{projects.map(project => <option key={project.id} value={project.id}>{project.code} — {project.name}</option>)}</select></label>
          <fieldset><legend className="form-label">نوع المستند *</legend><div className="grid grid-cols-2 gap-3"><button type="button" onClick={() => setKind("INVOICE")} className={`rounded-xl border p-4 text-right ${kind === "INVOICE" ? "border-primary bg-primary/5" : "hover:bg-muted"}`}><Receipt size={18} className="mb-2 text-primary" />فاتورة</button><button type="button" onClick={() => setKind("DEPOSIT_RECEIPT")} className={`rounded-xl border p-4 text-right ${kind === "DEPOSIT_RECEIPT" ? "border-primary bg-primary/5" : "hover:bg-muted"}`}><Landmark size={18} className="mb-2 text-primary" />إيصال إيداع</button></div></fieldset>
        </div><label><span className="form-label">ملاحظات</span><textarea value={notes} onChange={event => setNotes(event.target.value)} maxLength={2000} rows={3} className="input-field" placeholder="رقم الفاتورة أو أي بيان مفيد للمراجع" /></label>
        <label className={`flex min-h-24 cursor-pointer items-center justify-center gap-3 rounded-xl border-2 border-dashed p-5 text-sm font-medium ${uploading ? "pointer-events-none opacity-50" : "border-primary/40 hover:bg-primary/5"}`}><Camera size={20} />{uploading ? "جارٍ الرفع..." : "التقاط صورة أو اختيار ملف"}<input ref={fileRef} className="hidden" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={upload} /></label>
      </section>
      {message && <p role="status" className="rounded-xl border bg-card p-4 text-sm">{message}</p>}
      <section className="section-card"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-bold">آخر المستندات</h2><p className="text-sm text-muted-foreground">الرفع يتم باسم المستخدم وتحت المشروع المختار.</p></div><span className="rounded-full bg-muted px-3 py-1 text-xs">{submissions.length}</span></div>
      {loading ? <p className="py-12 text-center text-muted-foreground">جارٍ التحميل...</p> : submissions.length === 0 ? <p className="py-12 text-center text-muted-foreground">لا توجد فواتير أو إيصالات مرفوعة حتى الآن.</p> : <div className="divide-y">{submissions.map(item => <div key={item.id} className="flex gap-3 py-4"><span className="rounded-lg bg-muted p-2 text-primary"><FileText size={19} /></span><div className="min-w-0 flex-1"><a href={item.filePath} {...fileDragProps(item.filePath, item.originalName, item.fileType)} target="_blank" rel="noreferrer" className="font-medium text-primary underline">{item.originalName}</a><p className="mt-1 text-sm">{item.attachmentType === "CONTRACTING_INVOICE" ? "فاتورة" : "إيصال إيداع"} · {item.projectName}</p>{item.notes && <p className="mt-1 text-xs text-muted-foreground">{item.notes}</p>}<p className="mt-1 text-xs text-muted-foreground">رفع بواسطة {item.uploadedBy.nameAr} · {new Date(item.createdAt).toLocaleDateString("en-CA")}</p></div></div>)}</div>}</section>
    </main></div>;
}
