import { NextRequest, NextResponse } from "next/server";
import { assertCompanyAccess, assertPermission, requireRequestSession } from "@/lib/auth/access";
import { getInvestorStatement } from "@/lib/accounting/reports";

export async function GET(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId");
  const investorId = searchParams.get("investorId");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  if (!companyId || !investorId) {
    return NextResponse.json({ success: false, error: "companyId و investorId مطلوبان" }, { status: 400 });
  }

  const companyAccessError = assertCompanyAccess(session, companyId);
  if (companyAccessError) return companyAccessError;
  const permissionError = assertPermission(session, "INVESTOR_STATEMENTS", "VIEW", { companyId });
  if (permissionError) return permissionError;

  const data = await getInvestorStatement(
    investorId,
    companyId,
    startDate ? new Date(startDate) : undefined,
    endDate ? new Date(endDate) : undefined,
  );

  return NextResponse.json({ success: true, data });
}
