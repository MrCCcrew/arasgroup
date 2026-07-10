"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface Account {
  code: string;
  nameAr: string;
  type: string;
}

interface Line {
  id: string;
  debit: number;
  credit: number;
  descriptionAr?: string;
  account: Account;
}

interface Entry {
  id: string;
  number: string;
  date: string;
  type: string;
  descriptionAr: string;
  reference?: string;
  totalDebit: number;
  totalCredit: number;
  status: string;
  lines: Line[];
  createdBy: { nameAr: string };
  approvedBy?: { nameAr: string } | null;
}

interface Company {
  nameAr: string;
  nameEn?: string;
  address?: string;
  phone?: string;
  logoUrl?: string | null;
}

function amountToWords(amount: number): string {
  const whole = Math.floor(amount);
  const fils = Math.round((amount - whole) * 1000);

  const ones = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة", "عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];
  const tens = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
  const hundreds = ["", "مائة", "مئتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];

  function below1000(n: number): string {
    if (n === 0) return "";
    if (n < 20) return ones[n];
    if (n < 100) {
      const t = tens[Math.floor(n / 10)];
      const o = ones[n % 10];
      return o ? `${o} و${t}` : t;
    }
    const h = hundreds[Math.floor(n / 100)];
    const rest = below1000(n % 100);
    return rest ? `${h} و${rest}` : h;
  }

  function numberToArabic(n: number): string {
    if (n === 0) return "صفر";
    const thou = Math.floor(n / 1000);
    const rem = n % 1000;
    let result = "";
    if (thou === 1) result = "ألف";
    else if (thou === 2) result = "ألفان";
    else if (thou > 2) result = `${below1000(thou)} آلاف`;
    if (rem > 0) result = result ? `${result} و${below1000(rem)}` : below1000(rem);
    return result || "صفر";
  }

  let words = `${numberToArabic(whole)} دينار كويتي`;
  if (fils > 0) words += ` و${numberToArabic(fils)} فلس`;
  words += " فقط لا غير";
  return words;
}

function VoucherBody({ entry, company, copy }: { entry: Entry; company: Company; copy: boolean }) {
  const isReceipt = entry.type === "RECEIPT";
  const isPayment = entry.type === "PAYMENT";
  const isVoucher = isReceipt || isPayment;

  const title = isReceipt ? "سند قبض" : isPayment ? "سند صرف" : "قيد يومي";
  const titleEn = isReceipt ? "Receipt Voucher" : isPayment ? "Payment Voucher" : "Journal Entry";
  const amount = Number(entry.totalDebit);

  const descriptionParts = entry.descriptionAr.split(/\s[-—]\s/);
  const partyLine = descriptionParts.length > 1 ? descriptionParts.slice(1).join(" - ") : "";
  const descLine = descriptionParts[0] ?? entry.descriptionAr;

  const dateObj = new Date(entry.date);
  const dateStr = dateObj.toLocaleDateString("ar-KW", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="voucher-body">
      <div className="voucher-header">
        <div className="company-info">
          {company.logoUrl && <img src={company.logoUrl} alt={company.nameAr} className="company-logo" />}
          <div>
            <h1 className="company-name">{company.nameAr}</h1>
            {company.nameEn && <p className="company-name-en">{company.nameEn}</p>}
            {company.address && <p className="company-detail">{company.address}</p>}
            {company.phone && <p className="company-detail" dir="ltr">{company.phone}</p>}
          </div>
        </div>
        <div className="voucher-title-box">
          <h2 className="voucher-title">{title}</h2>
          <p className="voucher-title-en">{titleEn}</p>
          <div className="copy-badge">{copy ? "صورة - Copy" : "أصل - Original"}</div>
        </div>
      </div>

      <div className="voucher-meta">
        <div className="meta-row">
          <span className="meta-label">رقم السند:</span>
          <span className="meta-value" dir="ltr">{entry.number}</span>
          <span className="meta-label" style={{ marginRight: "2rem" }}>التاريخ:</span>
          <span className="meta-value">{dateStr}</span>
        </div>
        {entry.reference && (
          <div className="meta-row">
            <span className="meta-label">المرجع:</span>
            <span className="meta-value" dir="ltr">{entry.reference}</span>
          </div>
        )}
      </div>

      {isVoucher ? (
        <>
          <div className="voucher-field">
            <span className="field-label">{isReceipt ? "استلمنا من السيد/ة:" : "صرف إلى السيد/ة:"}</span>
            <span className="field-value field-underline">{partyLine || "................................................................................................"}</span>
          </div>

          <div className="voucher-field">
            <span className="field-label">وذلك عن:</span>
            <span className="field-value field-underline">{descLine}</span>
          </div>

          <div className="voucher-field">
            <span className="field-label">مبلغ وقدره:</span>
            <span className="field-value amount-box">{amount.toFixed(3)} د.ك</span>
          </div>

          <div className="voucher-field">
            <span className="field-label">فقط:</span>
            <span className="field-value amount-words">{amountToWords(amount)}</span>
          </div>
        </>
      ) : (
        <div className="accounts-section">
          <div className="voucher-field">
            <span className="field-label">البيان:</span>
            <span className="field-value">{entry.descriptionAr}</span>
          </div>
          <table className="accounts-table" style={{ marginTop: "1rem" }}>
            <thead>
              <tr>
                <th>الحساب</th>
                <th>كود</th>
                <th>البيان</th>
                <th>مدين</th>
                <th>دائن</th>
              </tr>
            </thead>
            <tbody>
              {entry.lines.map((line, i) => (
                <tr key={i}>
                  <td>{line.account.nameAr}</td>
                  <td dir="ltr">{line.account.code}</td>
                  <td>{line.descriptionAr ?? "-"}</td>
                  <td dir="ltr" className="num-cell">{Number(line.debit) > 0 ? Number(line.debit).toFixed(3) : "-"}</td>
                  <td dir="ltr" className="num-cell">{Number(line.credit) > 0 ? Number(line.credit).toFixed(3) : "-"}</td>
                </tr>
              ))}
              <tr className="totals-row">
                <td colSpan={3}><strong>المجموع</strong></td>
                <td dir="ltr" className="num-cell"><strong>{amount.toFixed(3)}</strong></td>
                <td dir="ltr" className="num-cell"><strong>{Number(entry.totalCredit).toFixed(3)}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="signatures">
        <div className="sig-col">
          <div className="sig-line" />
          <p className="sig-label">المحرر</p>
          <p className="sig-name">{entry.createdBy?.nameAr ?? ""}</p>
        </div>
        <div className="sig-col">
          <div className="sig-line" />
          <p className="sig-label">المراجع</p>
          <p className="sig-name"></p>
        </div>
        <div className="sig-col">
          <div className="sig-line" />
          <p className="sig-label">المعتمد</p>
          <p className="sig-name">{entry.approvedBy?.nameAr ?? ""}</p>
        </div>
        <div className="sig-col">
          <div className="sig-line" />
          <p className="sig-label">{isReceipt ? "المستلم" : "المستفيد"}</p>
          <p className="sig-name"></p>
        </div>
      </div>
    </div>
  );
}

export default function PrintVoucherPage() {
  const params = useParams<{ companyId: string; id: string }>();
  const { companyId, id } = params;

  const [entry, setEntry] = useState<Entry | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/accounting/journal-entries/${id}`).then((r) => r.json()),
      fetch(`/api/companies/${companyId}`).then((r) => r.json()),
    ]).then(([je, co]) => {
      if (je.success) setEntry(je.data);
      if (co.success) setCompany(co.data);
      setLoading(false);
    });
  }, [id, companyId]);

  if (loading) {
    return <div style={{ padding: "2rem", textAlign: "center", fontFamily: "Arial" }}>جار التحميل...</div>;
  }

  if (!entry || !company) {
    return <div style={{ padding: "2rem", textAlign: "center", fontFamily: "Arial" }}>القيد غير موجود</div>;
  }

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; background: #f5f5f5; }
        .print-controls { position: fixed; top: 1rem; left: 1rem; display: flex; gap: 0.5rem; z-index: 100; }
        .print-controls button {
          display: flex; align-items: center; gap: 0.4rem; background: #1d4ed8; color: white; border: none;
          padding: 0.5rem 1.2rem; border-radius: 0.5rem; font-size: 0.9rem; cursor: pointer; font-family: inherit;
        }
        .print-controls a {
          display: flex; align-items: center; background: #6b7280; color: white; border: none;
          padding: 0.5rem 1.2rem; border-radius: 0.5rem; font-size: 0.9rem; cursor: pointer; text-decoration: none; font-family: inherit;
        }
        .page-wrapper { max-width: 210mm; margin: 2rem auto; display: flex; flex-direction: column; gap: 0; }
        .voucher-body { background: white; padding: 1.5rem 2rem; border: 1px solid #d1d5db; }
        .voucher-body + .voucher-body { border-top: 2px dashed #9ca3af; }
        .voucher-header {
          display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 1rem; margin-bottom: 1rem; border-bottom: 2px solid #1e3a8a;
        }
        .company-info { display: flex; align-items: flex-start; gap: 0.75rem; }
        .company-logo { width: 70px; height: 70px; object-fit: contain; border-radius: 6px; border: 1.5px solid #1e3a8a; padding: 4px; background: white; }
        .company-name { font-size: 1.4rem; font-weight: 800; color: #1e3a8a; }
        .company-name-en { font-size: 0.95rem; font-weight: 600; color: #374151; direction: ltr; text-align: left; margin-top: 0.2rem; }
        .company-detail { font-size: 0.78rem; color: #6b7280; margin-top: 0.15rem; }
        .voucher-title-box { text-align: center; border: 2px solid #1e3a8a; border-radius: 0.5rem; padding: 0.5rem 1.5rem; }
        .voucher-title { font-size: 1.3rem; font-weight: 700; color: #1e3a8a; }
        .voucher-title-en { font-size: 0.8rem; color: #6b7280; direction: ltr; }
        .copy-badge { margin-top: 0.3rem; font-size: 0.75rem; font-weight: 600; color: #374151; background: #f3f4f6; border-radius: 0.25rem; padding: 0.1rem 0.5rem; display: inline-block; }
        .voucher-meta { margin-bottom: 1rem; }
        .meta-row { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.4rem; font-size: 0.88rem; }
        .meta-label { font-weight: 700; color: #374151; white-space: nowrap; }
        .meta-value { font-weight: 700; color: #111827; }
        .voucher-field { display: flex; align-items: baseline; gap: 0.5rem; margin-bottom: 0.9rem; font-size: 0.9rem; }
        .field-label { font-weight: 700; color: #374151; white-space: nowrap; min-width: 7rem; }
        .field-value { flex: 1; font-weight: 700; color: #111827; }
        .field-underline { border-bottom: 1px solid #374151; padding-bottom: 0.1rem; min-width: 200px; }
        .amount-box {
          border: 2px solid #1e3a8a; border-radius: 0.3rem; padding: 0.3rem 1.2rem; font-weight: 800; font-size: 1.1rem;
          color: #1e3a8a; display: inline-block; text-align: right;
        }
        .amount-words { font-weight: 600; color: #1e3a8a; font-size: 0.92rem; }
        .accounts-section { margin: 1rem 0; }
        .accounts-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
        .accounts-table th {
          background: #1e3a8a; color: white; padding: 0.4rem 0.6rem; text-align: right; font-weight: 600; border: 1px solid #1e3a8a;
        }
        .accounts-table td { padding: 0.35rem 0.6rem; border: 1px solid #d1d5db; color: #111827; }
        .accounts-table tr:nth-child(even) td { background: #f9fafb; }
        .num-cell { text-align: left; font-variant-numeric: tabular-nums; }
        .totals-row td { background: #f3f4f6 !important; font-weight: 700; border-top: 2px solid #374151; }
        .signatures { display: flex; gap: 0; margin-top: 1.5rem; border-top: 1px solid #d1d5db; padding-top: 1rem; }
        .sig-col { flex: 1; text-align: center; padding: 0 0.5rem; border-left: 1px solid #e5e7eb; }
        .sig-col:last-child { border-left: none; }
        .sig-line { height: 2.5rem; border-bottom: 1px solid #374151; margin-bottom: 0.4rem; }
        .sig-label { font-size: 0.82rem; font-weight: 600; color: #374151; }
        .sig-name { font-size: 0.78rem; color: #6b7280; margin-top: 0.2rem; min-height: 1rem; }
        @media print {
          .print-controls { display: none !important; }
          body { background: white; }
          .page-wrapper { margin: 0; max-width: 100%; }
          .voucher-body { border: none; padding: 1.2rem 1.5rem; }
          .voucher-body + .voucher-body { border-top: 2px dashed #9ca3af; }
          @page { size: A4; margin: 1cm; }
        }
      `}</style>

      <div className="print-controls">
        <button onClick={() => window.print()}>طباعة</button>
        <a href={`/dashboard/companies/${companyId}/accounting/journal-entries`}>العودة</a>
      </div>

      <div className="page-wrapper">
        <VoucherBody entry={entry} company={company} copy={false} />
        <VoucherBody entry={entry} company={company} copy={true} />
      </div>
    </>
  );
}
