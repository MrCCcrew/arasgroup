"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, Trash2, X } from "lucide-react";
import { adjustmentTotal, salaryAdjustmentSchema, type SalaryAdjustment } from "@/lib/hr/salary-adjustments";

const additionTypes = [
  { ar: "مكافأة", en: "Bonus" },
  { ar: "عمل إضافي", en: "Overtime" },
  { ar: "بدل انتقال", en: "Transport allowance" },
  { ar: "بدل سكن", en: "Housing allowance" },
  { ar: "تعويض مصروفات", en: "Expense reimbursement" },
  { ar: "تسوية راتب", en: "Salary adjustment" },
];
const deductionTypes = [
  { ar: "سلفة", en: "Salary advance" },
  { ar: "غياب", en: "Absence" },
  { ar: "تأخير", en: "Late attendance" },
  { ar: "مخالفة", en: "Violation" },
  { ar: "قسط", en: "Installment" },
  { ar: "كاش معلق", en: "Outstanding cash" },
  { ar: "تذكرة طيران", en: "Air ticket" },
  { ar: "خصم مرحل من شهر سابق", en: "Deduction carried forward from a previous month" },
  { ar: "تسوية راتب", en: "Salary adjustment" },
];

interface Props {
  label: string;
  employeeName: string;
  locale: "ar" | "en";
  deduction?: boolean;
  total: string;
  items?: SalaryAdjustment[];
  disabled?: boolean;
  onChange: (items: SalaryAdjustment[]) => void;
}

export function SalaryAdjustmentEditor({ label, employeeName, locale, deduction, total, items, disabled, onChange }: Props) {
  const ar = locale !== "en";
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Array<{ titleAr: string; titleEn?: string; amount: string; custom?: boolean }>>([]);
  const [error, setError] = useState("");
  const options = deduction ? deductionTypes : additionTypes;

  function changeOpen(value: boolean) {
    if (value) {
      const initial = items ?? (Number(total) > 0 ? [{ titleAr: label, amount: Number(total) }] : []);
      setRows(initial.map(item => ({ ...item, amount: String(item.amount) })));
      setError("");
    }
    setOpen(value);
  }

  function save() {
    const parsed = salaryAdjustmentSchema.array().max(100).safeParse(rows.map(row => ({ ...row, amount: Number(row.amount) })));
    if (!parsed.success) {
      setError(ar ? "اكتب نوع أو سبب كل بند ومبلغًا أكبر من صفر، بحد أقصى 3 منازل عشرية و100 بند." : "Enter a type or reason and a positive amount for every item (up to 3 decimal places and 100 items).");
      return;
    }
    onChange(parsed.data);
    setOpen(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={changeOpen}>
      <Dialog.Trigger asChild>
        <button type="button" disabled={disabled} className={`w-full min-w-24 rounded-md border px-2 py-1.5 text-center disabled:opacity-50 ${deduction ? "text-red-700" : "text-blue-700"}`} aria-label={`${label} - ${employeeName}`}>
          <span className="block tabular-nums" dir="ltr">{Number(total || 0).toFixed(3)}</span>
          <span className="block text-xs">{ar ? "تفصيل البنود" : "Itemize"}{items?.length ? ` (${items.length})` : ""}</span>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content dir={ar ? "rtl" : "ltr"} className="fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[calc(100%_-_2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-card p-5 shadow-xl" onKeyDown={event => {
          if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
            event.preventDefault();
          }
        }}>
          <div className="flex items-center justify-between gap-3">
            <Dialog.Title className="text-lg font-bold">{label} — {employeeName}</Dialog.Title>
            <Dialog.Close asChild><button type="button" aria-label={ar ? "إغلاق" : "Close"} className="rounded p-1 hover:bg-muted"><X size={18} /></button></Dialog.Close>
          </div>
          <Dialog.Description className="mb-4 mt-2 text-sm text-muted-foreground">
            {ar ? "اختر نوع البند أو اكتب سببه، وحدد مبلغه. سيظهر كل بند في تفاصيل الراتب المرسلة للموظف." : "Choose a type or enter a reason and amount. Each item appears in the employee's salary details."}
            <span className="mt-1 block font-medium">{ar ? "بعد تطبيق البنود، اضغط حفظ الدفعة أو حفظ التعديلات أسفل الصفحة لحفظها نهائيًا." : "After applying items, save the salary batch at the bottom of the page to keep your changes."}</span>
          </Dialog.Description>
          <div className="space-y-3">
            {rows.map((row, index) => {
              const selected = options.find(option => option.ar === row.titleAr);
              const custom = row.custom || (!!row.titleAr && !selected);
              return (
              <div key={index} className="flex items-end gap-2">
                <label className="min-w-0 flex-1 text-xs">{ar ? "نوع / سبب البند" : "Type / reason"}
                  <select className="input-field mt-1 w-full" value={custom ? "__custom__" : selected?.en ?? ""} onChange={event => {
                    const option = options.find(option => option.en === event.target.value);
                    const isCustom = event.target.value === "__custom__";
                    setRows(previous => previous.map((item, i) => i === index ? { ...item, titleAr: option?.ar ?? "", titleEn: option?.en ?? "", custom: isCustom } : item));
                  }}>
                    <option value="">{ar ? "اختر نوع البند" : "Choose an item type"}</option>
                    {options.map(option => <option key={option.en} value={option.en}>{option[locale]}</option>)}
                    <option value="__custom__">{ar ? "سبب آخر (كتابة)" : "Other reason (write in)"}</option>
                  </select>
                  {custom && <input aria-label={ar ? "السبب المخصص" : "Custom reason"} maxLength={191} className="input-field mt-2 w-full" value={ar ? row.titleAr : row.titleEn || row.titleAr} onChange={event => {
                    const value = event.target.value;
                    setRows(previous => previous.map((item, i) => i === index ? { ...item, titleAr: value, titleEn: value } : item));
                  }} />}
                </label>
                <label className="w-28 text-xs">{ar ? "المبلغ (د.ك)" : "Amount (KWD)"}
                  <input type="number" min="0.001" step="0.001" dir="ltr" className="input-field mt-1 w-full" value={row.amount} onChange={event => setRows(previous => previous.map((item, i) => i === index ? { ...item, amount: event.target.value } : item))} />
                </label>
                <button type="button" className="mb-1 rounded p-2 text-red-600 hover:bg-red-50" aria-label={`${ar ? "حذف البند" : "Remove item"} ${index + 1}`} onClick={() => setRows(previous => previous.filter((_, i) => i !== index))}><Trash2 size={16} /></button>
              </div>
            );})}
          </div>
          <button type="button" disabled={rows.length >= 100} className="my-4 flex items-center gap-1 text-sm text-blue-700 disabled:opacity-50" onClick={() => setRows(previous => [...previous, { titleAr: "", amount: "" }])}><Plus size={16} />{ar ? "إضافة بند" : "Add item"}</button>
          {error && <p role="alert" className="mb-3 text-sm text-red-600">{error}</p>}
          <div className="flex items-center justify-between gap-3 border-t pt-4">
            <span className="font-bold">{ar ? "الإجمالي: " : "Total: "}<bdi>{adjustmentTotal(rows.map(row => ({ ...row, amount: Number(row.amount) || 0 }))).toFixed(3)}</bdi></span>
            <div className="flex gap-2">
              <Dialog.Close asChild><button type="button" className="rounded border px-4 py-2 text-sm">{ar ? "إلغاء" : "Cancel"}</button></Dialog.Close>
              <button type="button" onClick={save} className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground">{ar ? "تطبيق البنود" : "Apply items"}</button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
