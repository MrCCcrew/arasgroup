import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { POST as submit } from "@/app/api/companies/[companyId]/grocery/submissions/route";
import { getRetailTransactions } from "@/lib/grocery/transactions";

async function employeeCompany() {
  const session = await getSession();
  if (!session || String(session.accountType) !== "GROCERY_EMPLOYEE") return null;
  const companyId = session.roles.find((role) => role.name === "GROCERY_EMPLOYEE")?.companyId;
  return companyId ? { session, companyId } : null;
}

export async function GET() {
  const current = await employeeCompany();
  if (!current) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
  return NextResponse.json({ success: true, data: { transactions: await getRetailTransactions(current.companyId, current.session.id) } });
}

export async function POST(request: NextRequest) {
  const current = await employeeCompany();
  if (!current) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
  return submit(request, { params: Promise.resolve({ companyId: current.companyId }) });
}
