import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";

export async function requireOwnerManagedCompany(session: SessionUser, companyId: string) {
  const company = await prisma.company.findFirst({ where: { id: companyId, type: "OWNER_MANAGED", isActive: true } });
  if (!company || (!session.isSuperAdmin && !session.companyAccess.includes(companyId))) return null;
  return company;
}

export async function getPartnerFromSession(session: SessionUser) {
  return prisma.ownerManagedPartner.findFirst({ where: { userId: session.id, isActive: true }, include: { company: true } });
}

export function forbidden() { return NextResponse.json({ success: false, error: "غير مصرح" }, { status: 403 }); }
