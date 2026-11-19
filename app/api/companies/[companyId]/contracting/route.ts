import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRequestSession, assertCompanyAccess } from "@/lib/auth/access";
import { hasPermission, type Action } from "@/lib/auth/permissions";
import { inputSchema } from "@/lib/contracting/input";
import { saveConstruction } from "@/lib/contracting/service";
import { contractBalances, money } from "@/lib/contracting/calculations";
import { journalMonthRange, journalPage } from "@/lib/accounting/journal-list";
type Props = { params: Promise<{ companyId: string }> };
async function access(request: NextRequest, companyId: string, action: Action = "VIEW") {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  const denied = assertCompanyAccess(session, companyId);
  if (denied) return denied;
  if (!(hasPermission(session, "ACCOUNTING", action, { companyId }) || (action !== "APPROVE" && hasPermission(session, "CONTRACTING", action, { companyId })))) return NextResponse.json({ success: false, error: "غير مصرح" }, { status: 403 });
  if (!await prisma.company.findFirst({ where: { id: companyId, type: "CONTRACTING", isActive: true }, select: { id: true } })) return NextResponse.json({ success: false, error: "الشركة ليست شركة مقاولات" }, { status: 404 });
  return session;
}
export async function GET(request: NextRequest, { params }: Props) {
  const { companyId } = await params;
  const session = await access(request, companyId);
  if (session instanceof NextResponse) return session;
  const query = request.nextUrl.searchParams;
  const projects = await prisma.constructionProject.findMany({ where: { companyId }, orderBy: { createdAt: "desc" }, include: { _count: { select: { contracts: true, documents: true } } } });
  const projectId = query.get("projectId") || projects[0]?.id;
  const project = projects.find(p => p.id === projectId);
  if (projectId && !project) return NextResponse.json({ success: false, error: "المشروع غير موجود" }, { status: 404 });
  const permissions = Object.fromEntries(["CREATE", "UPDATE", "DELETE", "APPROVE"].map(action => [action, hasPermission(session, "ACCOUNTING", action as Action, { companyId }) || (action !== "APPROVE" && hasPermission(session, "CONTRACTING", action as Action, { companyId }))]));
  const cashAccounts = await prisma.chartOfAccount.findMany({ where: { companyId, isActive: true, isHeader: false, type: "ASSET", OR: [{ code: { in: ["1000", "1010"] } }, { bankAccounts: { some: { companyId, isActive: true } } }] }, select: { id: true, code: true, nameAr: true } });
  if (!project) return NextResponse.json({ success: true, data: { projects, project: null, contracts: [], documents: [], dailyLogs: [], cashAccounts, permissions, total: 0, page: 1 } });
  const month = journalMonthRange(query.get("month") ?? undefined);
  const where = { projectId: project.id, ...(month ? { date: month } : {}) };
  const total = await prisma.constructionDocument.count({ where });
  const page = journalPage(query.get("page") ?? undefined, total, 30);
  const [contracts, documents, dailyLogs, allMovements, ledger] = await Promise.all([
    prisma.constructionContract.findMany({ where: { projectId: project.id }, orderBy: { createdAt: "asc" } }),
    prisma.constructionDocument.findMany({ where, include: { contract: { select: { partyName: true, kind: true } }, journalEntry: { select: { id: true, number: true, status: true, isDeleted: true, isReversed: true } } }, orderBy: [{ date: "desc" }, { id: "desc" }], skip: (page - 1) * 30, take: 30 }),
    prisma.constructionDailyLog.findMany({ where, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 60 }),
    prisma.constructionDocument.findMany({ where: { projectId: project.id, status: "APPROVED", journalEntry: { isDeleted: false, isReversed: false, status: { notIn: ["CANCELLED", "REJECTED"] } } } }),
    prisma.journalEntryLine.findMany({ where: { costCenterId: project.costCenterId, journalEntry: { companyId, isDeleted: false, status: "POSTED", ...(month ? { date: month } : {}) } }, select: { debit: true, credit: true, account: { select: { type: true } } } }),
  ]);
  const revenue = ledger.filter(l => l.account.type === "REVENUE").reduce((s, l) => s.add(l.credit).sub(l.debit), money(0));
  const costs = ledger.filter(l => l.account.type === "EXPENSE").reduce((s, l) => s.add(l.debit).sub(l.credit), money(0));
  return NextResponse.json({ success: true, data: { projects, project, cashAccounts, permissions, contracts: contracts.map(c => ({ ...c, balances: contractBalances(allMovements.filter(r => r.contractId === c.id)) })), documents, dailyLogs, total, page, report: { revenue, costs, margin: revenue.sub(costs) } } });
}
export async function POST(request: NextRequest, { params }: Props) {
  const { companyId } = await params;
  const session = await access(request, companyId);
  if (session instanceof NextResponse) return session;
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: "راجع الحقول المطلوبة والمبالغ والتواريخ", details: parsed.error.flatten() }, { status: 400 });
  const action: Action = parsed.data.action === "approve" ? "APPROVE" : parsed.data.action === "void" ? "DELETE" : ["projectStatus", "projectUpdate", "contractUpdate"].includes(parsed.data.action) ? "UPDATE" : "CREATE";
  const authorized = await access(request, companyId, action);
  if (authorized instanceof NextResponse) return authorized;
  try { return NextResponse.json({ success: true, data: await saveConstruction(companyId, session.id, parsed.data) }); }
  catch (e) {
    const duplicate = typeof e === "object" && e !== null && "code" in e && e.code === "P2002";
    return NextResponse.json({ success: false, error: duplicate ? "الرقم أو المرجع مستخدم بالفعل؛ اختر رقمًا مختلفًا" : e instanceof Error ? e.message : "تعذر حفظ العملية" }, { status: duplicate ? 409 : 400 });
  }
}
