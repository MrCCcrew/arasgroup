import { NextRequest, NextResponse } from "next/server";
import { assertCompanyAccess, assertPermission, requireRequestSession } from "@/lib/auth/access";
import { getTrialBalance } from "@/lib/accounting/journal-engine";
import { getAccountLedger, getBalanceSheet, getIncomeStatement } from "@/lib/accounting/reports";

export async function GET(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

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

    const companyAccessError = assertCompanyAccess(session, companyId);
    if (companyAccessError) return companyAccessError;

    const permissionError = assertPermission(session, "ACCOUNTING", "VIEW", { companyId });
    if (permissionError) return permissionError;

    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    switch (type) {
      case "trial_balance":
        if (!fiscalYearId) {
          return NextResponse.json({ success: false, error: "fiscalYearId مطلوب" }, { status: 400 });
        }
        return NextResponse.json({
          success: true,
          data: await getTrialBalance(companyId, fiscalYearId, start, end),
        });

      case "income_statement":
        if (!fiscalYearId) {
          return NextResponse.json({ success: false, error: "fiscalYearId مطلوب" }, { status: 400 });
        }
        return NextResponse.json({
          success: true,
          data: await getIncomeStatement(companyId, fiscalYearId, start, end),
        });

      case "balance_sheet":
        if (!fiscalYearId) {
          return NextResponse.json({ success: false, error: "fiscalYearId مطلوب" }, { status: 400 });
        }
        return NextResponse.json({
          success: true,
          data: await getBalanceSheet(companyId, fiscalYearId, end),
        });

      case "ledger":
        if (!accountId) {
          return NextResponse.json({ success: false, error: "accountId مطلوب" }, { status: 400 });
        }
        return NextResponse.json({
          success: true,
          data: await getAccountLedger(companyId, accountId, fiscalYearId, start, end),
        });

      default:
        return NextResponse.json({ success: false, error: "نوع التقرير غير معروف" }, { status: 400 });
    }
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "فشل في إنشاء التقرير" }, { status: 500 });
  }
}
