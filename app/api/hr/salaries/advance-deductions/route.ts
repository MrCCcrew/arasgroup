import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertCompanyAccess, assertPermission, requireRequestSession } from "@/lib/auth/access";
import { getAccessibleBranchIds } from "@/lib/auth/permissions";
import { dueAdvanceInstallments } from "@/lib/hr/employee-advances";

export async function GET(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  const query = request.nextUrl.searchParams;
  const companyId = query.get("companyId") || "";
  const access = assertCompanyAccess(session, companyId) || assertPermission(session, "SALARIES", "VIEW", { companyId });
  if (access) return access;
  const year = Number(query.get("year"));
  const month = Number(query.get("month"));
  if (!Number.isInteger(year) || year < 2020 || !Number.isInteger(month) || month < 1 || month > 12) return NextResponse.json({ success: false, error: "اختر شهر وسنة صحيحين" }, { status: 400 });
  const batchId = query.get("batchId") || undefined;
  if (batchId && !await prisma.salaryBatch.findFirst({ where: { id: batchId, companyId } })) return NextResponse.json({ success: false }, { status: 404 });
  const branches = getAccessibleBranchIds(session, companyId);
  const employees = await prisma.employee.findMany({ where: { companyId, ...(branches.length ? { branchId: { in: branches } } : {}) }, select: { id: true } });
  const rows = await dueAdvanceInstallments(prisma, companyId, year, month, batchId, employees.map(employee => employee.id));
  const totals: Record<string, number> = {};
  for (const row of rows) totals[row.advance.employeeId] = Math.round(((totals[row.advance.employeeId] || 0) + Number(row.amount)) * 1000) / 1000;
  return NextResponse.json({ success: true, data: totals });
}
