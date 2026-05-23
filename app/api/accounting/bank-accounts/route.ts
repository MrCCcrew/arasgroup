import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");

    if (!companyId) {
      return NextResponse.json({ success: false, error: "companyId مطلوب" }, { status: 400 });
    }

    const accounts = await prisma.bankAccount.findMany({
      where: { companyId, isActive: true },
      orderBy: [{ isDefault: "desc" }, { nameAr: "asc" }],
    });

    return NextResponse.json({ success: true, data: accounts });
  } catch {
    return NextResponse.json({ success: false, error: "فشل في جلب الحسابات البنكية" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, nameAr, nameEn, bankName, accountNumber, iban, currency, isDefault } = body;

    if (!companyId || !nameAr || !bankName || !accountNumber) {
      return NextResponse.json(
        { success: false, error: "companyId و nameAr و bankName و accountNumber مطلوبة" },
        { status: 400 }
      );
    }

    const account = await prisma.bankAccount.create({
      data: {
        companyId,
        nameAr,
        nameEn,
        bankName,
        accountNumber,
        iban,
        currency: currency ?? "KWD",
        isDefault: isDefault ?? false,
      },
    });

    return NextResponse.json({ success: true, data: account }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في إنشاء الحساب البنكي";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
