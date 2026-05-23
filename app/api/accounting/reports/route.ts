import { NextRequest, NextResponse } from "next/server";
import { getTrialBalance } from "@/lib/accounting/journal-engine";
import { getIncomeStatement, getBalanceSheet, getAccountLedger } from "@/lib/accounting/reports";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const companyId = searchParams.get("companyId");
    const fiscalYearId = searchParams.get("fiscalYearId") ?? undefined;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const accountId = searchParams.get("accountId");

    if (!companyId) {
      return NextResponse.json({ success: false, error: "companyId مطلوب" }, { status: 400 });
    }

    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    switch (type) {
      case "trial_balance": {
        if (!fiscalYearId) return NextResponse.json({ success: false, error: "fiscalYearId مطلوب" }, { status: 400 });
        const data = await getTrialBalance(companyId, fiscalYearId, start, end);
        return NextResponse.json({ success: true, data });
      }
      case "income_statement": {
        if (!fiscalYearId) return NextResponse.json({ success: false, error: "fiscalYearId مطلوب" }, { status: 400 });
        const data = await getIncomeStatement(companyId, fiscalYearId, start, end);
        return NextResponse.json({ success: true, data });
      }
      case "balance_sheet": {
        if (!fiscalYearId) return NextResponse.json({ success: false, error: "fiscalYearId مطلوب" }, { status: 400 });
        const data = await getBalanceSheet(companyId, fiscalYearId, end);
        return NextResponse.json({ success: true, data });
      }
      case "ledger": {
        if (!accountId) {
          return NextResponse.json({ success: false, error: "accountId مطلوب" }, { status: 400 });
        }
        const data = await getAccountLedger(companyId, accountId, fiscalYearId, start, end);
        return NextResponse.json({ success: true, data });
      }
      default:
        return NextResponse.json({ success: false, error: "نوع التقرير غير معروف" }, { status: 400 });
    }
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "فشل في إنشاء التقرير" }, { status: 500 });
  }
}
