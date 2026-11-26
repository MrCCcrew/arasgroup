"use client";
import { Eye, Pencil, Check, X, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createPortal } from "react-dom";

const r3 = (n: number) => Math.round(n * 1000) / 1000;

function ApproveDialog({ amount, busy, onClose, onConfirm }: { amount: number; busy: boolean; onClose: () => void; onConfirm: (talabat: number, company: number) => void }) {
  const [talabat, setTalabat] = useState("0");
  const [company, setCompany] = useState(amount.toFixed(3));
  const t = Number(talabat) || 0;
  const c = Number(company) || 0;
  const total = r3(t + c);
  const diff = r3(total - amount);
  const invalid = t < 0 || c < 0 || total <= 0 || Number.isNaN(Number(talabat)) || Number.isNaN(Number(company));
  const fill = (which: "t" | "c") => {
    if (which === "t") { setTalabat(amount.toFixed(3)); setCompany("0"); } else { setCompany(amount.toFixed(3)); setTalabat("0"); }
  };
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" dir="rtl" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold">اعتماد الإيداع</h3>
        <p className="mt-1 text-sm text-muted-foreground">مبلغ الإيصال: <b className="number">{amount.toFixed(3)} د.ك</b> — وزّع المبلغ حسب مكان الإيداع.</p>
        <div className="mt-4 space-y-3">
          <label className="block rounded-xl border border-orange-200 bg-orange-50/60 p-3">
            <span className="flex items-center justify-between text-sm font-semibold text-orange-800">إيداع في شركة طلبات مباشرة<button type="button" onClick={() => fill("t")} className="text-xs font-normal underline">كله طلبات</button></span>
            <span className="mt-0.5 block text-xs text-orange-700/80">يتسدد من المبالغ اللي بتطالبنا بيها طلبات</span>
            <input type="number" step="0.001" min="0" value={talabat} onChange={(e) => setTalabat(e.target.value)} className="input-field number mt-2 w-full" />
          </label>
          <label className="block rounded-xl border border-cyan-200 bg-cyan-50/60 p-3">
            <span className="flex items-center justify-between text-sm font-semibold text-cyan-800">إيداع في شركة التوصيل<button type="button" onClick={() => fill("c")} className="text-xs font-normal underline">كله للشركة</button></span>
            <span className="mt-0.5 block text-xs text-cyan-700/80">المبلغ دخل حساب الشركة ويفضل من المبالغ المسجلة على الشركة</span>
            <input type="number" step="0.001" min="0" value={company} onChange={(e) => setCompany(e.target.value)} className="input-field number mt-2 w-full" />
          </label>
        </div>
        <div className="mt-3 flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-sm">
          <span>الإجمالي</span><b className="number">{total.toFixed(3)} د.ك</b>
        </div>
        {diff !== 0 && !invalid && (
          <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">تنبيه: الإجمالي {diff > 0 ? "أكبر" : "أقل"} من مبلغ الإيصال بـ {Math.abs(diff).toFixed(3)} د.ك — هيتسجل الإجمالي اللي كتبته.</p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">إلغاء</button>
          <button type="button" disabled={busy || invalid} onClick={() => onConfirm(r3(t), r3(c))} className="btn-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">{busy ? "جاري الاعتماد..." : "اعتماد"}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function DepositSubmissionActions({ id, imagePath, amount, date, notes, status }: { id: string; imagePath: string; amount: number; date: string; notes: string | null; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  async function call(body?: object, method = "PATCH") {
    setBusy(true);
    try {
      const r = await fetch(`/api/delivery/deposits/${id}`, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
      const x = await r.json();
      if (!r.ok || !x.success) throw new Error(x.error ?? "فشلت العملية");
      setApproveOpen(false);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "فشلت العملية");
    } finally {
      setBusy(false);
    }
  }
  function edit() { const next = prompt("المبلغ", amount.toFixed(3)); if (next === null) return; const nextDate = prompt("تاريخ الإيداع", date) ?? date; const nextNotes = prompt("ملاحظات", notes ?? ""); if (!Number(next) || Number(next) <= 0) return alert("المبلغ غير صحيح"); void call({ amount: Number(next), depositDate: nextDate, notes: nextNotes || null }); }
  function reject() { const reason = prompt("سبب الرفض"); if (reason && reason.trim().length >= 3) void call({ status: "REJECTED", rejectionReason: reason }); }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <a href={imagePath} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary underline"><Eye size={15} />عرض</a>
      {status === "PENDING_REVIEW" && (
        <>
          <button disabled={busy} onClick={() => setApproveOpen(true)} className="inline-flex items-center gap-1 text-green-700 underline"><Check size={15} />موافقة</button>
          <button disabled={busy} onClick={reject} className="inline-flex items-center gap-1 text-red-700 underline"><X size={15} />رفض</button>
          <button disabled={busy} onClick={edit} className="inline-flex items-center gap-1 text-primary underline"><Pencil size={15} />تعديل</button>
          <button disabled={busy} onClick={() => { if (confirm("حذف الإيداع المرفوع؟")) void call(undefined, "DELETE"); }} className="inline-flex items-center gap-1 text-red-700 underline"><Trash2 size={15} />حذف</button>
        </>
      )}
      {approveOpen && <ApproveDialog amount={amount} busy={busy} onClose={() => !busy && setApproveOpen(false)} onConfirm={(t, c) => void call({ status: "APPROVED", talabatAmount: t, companyAmount: c })} />}
    </div>
  );
}
