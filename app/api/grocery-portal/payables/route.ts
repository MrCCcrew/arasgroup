import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { GET as list, POST as save } from "@/app/api/companies/[companyId]/grocery/payables/route";

async function companyId() { const session = await getSession(); return String(session?.accountType) === "GROCERY_EMPLOYEE" ? session?.roles.find((role) => role.name === "GROCERY_EMPLOYEE")?.companyId ?? null : null; }
export async function GET(request: NextRequest) { const id = await companyId(); return id ? list(request, { params: Promise.resolve({ companyId: id }) }) : NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 }); }
export async function POST(request: NextRequest) { const id = await companyId(); return id ? save(request, { params: Promise.resolve({ companyId: id }) }) : NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 }); }
