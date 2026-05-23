import { NextRequest, NextResponse } from "next/server";
import { getTrialBalance } from "@/lib/accounting/journal-engine";
import { getIncomeStatement, getBalanceSheet } from "@/lib/accounting/reports";
import { exportTrialBalanceToExcel } from "@/lib/reports/excel";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format"); // excel | pdf
    const reportType = searchParams.get("type"); // trial_balance | journal | ...
    const companyId = searchParams.get("companyId");
    const fiscalYearId = searchParams.get("fiscalYearId");

    if (!companyId || !fiscalYearId) {
      return NextResponse.json({ success: false, error: "المعاملات مطلوبة" }, { status: 400 });
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { nameAr: true },
    });

    const fy = await prisma.fiscalYear.findUnique({
      where: { id: fiscalYearId },
    });

    if (format === "excel" && reportType === "trial_balance") {
      const rows = await getTrialBalance(companyId, fiscalYearId);
      const buffer = exportTrialBalanceToExcel(rows, company?.nameAr ?? "", fy?.year ?? 0);

      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="trial-balance-${fy?.year}.xlsx"`,
        },
      });
    }

    if (format === "excel" && reportType === "income_statement") {
      const report = await getIncomeStatement(companyId, fiscalYearId);
      const wb = XLSX.utils.book_new();
      const rows = [
        [`${company?.nameAr ?? ""} — قائمة الدخل ${fy?.year ?? ""}`],
        [],
        ["كود الحساب", "اسم الحساب", "المبلغ"],
        ["", "الإيرادات", ""],
        ...report.revenues.map((r) => [r.code, r.nameAr, r.amount.toFixed(3)]),
        ["", "إجمالي الإيرادات", report.totalRevenue.toFixed(3)],
        [],
        ["", "المصروفات", ""],
        ...report.expenses.map((e) => [e.code, e.nameAr, e.amount.toFixed(3)]),
        ["", "إجمالي المصروفات", report.totalExpenses.toFixed(3)],
        [],
        ["", report.netIncome >= 0 ? "صافي الربح" : "صافي الخسارة", report.netIncome.toFixed(3)],
      ];
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!dir"] = "RTL";
      ws["!cols"] = [{ wch: 14 }, { wch: 45 }, { wch: 16 }];
      XLSX.utils.book_append_sheet(wb, ws, "قائمة الدخل");
      const buffer: Buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="income-statement-${fy?.year}.xlsx"`,
        },
      });
    }

    if (format === "excel" && reportType === "balance_sheet") {
      const report = await getBalanceSheet(companyId, fiscalYearId);
      const wb = XLSX.utils.book_new();
      const rows = [
        [`${company?.nameAr ?? ""} — الميزانية العمومية ${fy?.year ?? ""}`],
        [],
        ["كود الحساب", "اسم الحساب", "المبلغ"],
        ["", "الأصول", ""],
        ...report.assets.map((a) => [a.code, a.nameAr, a.amount.toFixed(3)]),
        ["", "إجمالي الأصول", report.totalAssets.toFixed(3)],
        [],
        ["", "الالتزامات", ""],
        ...report.liabilities.map((l) => [l.code, l.nameAr, l.amount.toFixed(3)]),
        ["", "إجمالي الالتزامات", report.totalLiabilities.toFixed(3)],
        [],
        ["", "حقوق الملكية", ""],
        ...report.equity.map((e) => [e.code, e.nameAr, e.amount.toFixed(3)]),
        ["", "صافي الربح / الخسارة", report.netIncome.toFixed(3)],
        ["", "إجمالي حقوق الملكية + الربح", (report.totalEquity + report.netIncome).toFixed(3)],
      ];
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!dir"] = "RTL";
      ws["!cols"] = [{ wch: 14 }, { wch: 45 }, { wch: 16 }];
      XLSX.utils.book_append_sheet(wb, ws, "الميزانية العمومية");
      const buffer: Buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="balance-sheet-${fy?.year}.xlsx"`,
        },
      });
    }

    return NextResponse.json({ success: false, error: "نوع التصدير غير مدعوم" }, { status: 400 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "فشل في تصدير التقرير" }, { status: 500 });
  }
}
