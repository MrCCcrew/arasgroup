// استخراج قيمة الفاتورة وتاريخها من نص OCR — مرن يدعم العربي/الإنجليزي.
// دالة نقية (تُستخدم في المتصفح بعد تشغيل tesseract).

const TOTAL_KEYWORDS = [
  "total", "amount", "net", "grand total", "balance", "due", "paid",
  "الإجمالي", "الاجمالي", "المجموع", "الصافي", "صافي", "اجمالي", "مجموع", "المبلغ", "القيمة", "قيمة",
];

// تحويل الأرقام العربية/الفارسية والفواصل العربية إلى لاتينية
function normalizeDigits(input: string): string {
  return (input || "")
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/٫/g, ".") // الفاصلة العشرية العربية
    .replace(/٬/g, ","); // فاصلة الآلاف العربية
}

function toIso(y: string, mo: string, d: string): string | null {
  const Y = Number(y.length === 2 ? `20${y}` : y);
  const M = Number(mo);
  const D = Number(d);
  if (!Y || M < 1 || M > 12 || D < 1 || D > 31 || Y < 2000 || Y > 2100) return null;
  return `${Y}-${String(M).padStart(2, "0")}-${String(D).padStart(2, "0")}`;
}

export function extractDate(raw: string): string | null {
  const text = normalizeDigits(raw);
  // yyyy-mm-dd أو yyyy/mm/dd أو yyyy.mm.dd
  let m = text.match(/(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
  if (m) {
    const iso = toIso(m[1], m[2], m[3]);
    if (iso) return iso;
  }
  // dd/mm/yyyy أو dd-mm-yyyy أو dd.mm.yyyy (اليوم أولاً — الكويت)
  m = text.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (m) {
    const iso = toIso(m[3], m[2], m[1]);
    if (iso) return iso;
  }
  return null;
}

const AMOUNT_RE = /(\d{1,3}(?:,\d{3})+(?:\.\d{1,3})?|\d+(?:\.\d{1,3})?)/g;

function amountsIn(text: string): number[] {
  const out: number[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(AMOUNT_RE);
  while ((m = re.exec(text))) {
    const v = parseFloat(m[1].replace(/,/g, ""));
    if (!isNaN(v) && v > 0) out.push(v);
  }
  return out;
}

export function extractAmount(raw: string): number | null {
  const text = normalizeDigits(raw);
  const lines = text.split(/\r?\n+/);

  // أولاً: مبلغ بجانب كلمة دالة على الإجمالي
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (TOTAL_KEYWORDS.some((k) => lower.includes(k))) {
      const found = amountsIn(line);
      if (found.length > 0) return Math.max(...found);
    }
  }

  // وإلا: أكبر مبلغ في النص كله
  const all = amountsIn(text);
  if (all.length > 0) return Math.max(...all);
  return null;
}

export function parseInvoiceText(raw: string): { amount: number | null; date: string | null } {
  return { amount: extractAmount(raw), date: extractDate(raw) };
}
