import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        email: true,
        nameAr: true,
        nameEn: true,
        phone: true,
        isSuperAdmin: true,
        isActive: true,
        roles: {
          include: {
            role: {
              select: {
                name: true,
                nameAr: true,
                permissions: {
                  select: {
                    permission: {
                      select: { module: true, action: true, scope: true },
                    },
                  },
                },
              },
            },
          },
        },
        groupAccess: true,
        companyAccess: {
          include: {
            company: {
              select: { id: true, nameAr: true, nameEn: true, type: true, isActive: true, logoUrl: true },
            },
          },
        },
        branchAccess: {
          include: {
            branch: { select: { id: true, nameAr: true } },
          },
        },
        directPermissions: {
          include: {
            permission: {
              select: {
                id: true,
                module: true,
                action: true,
                scope: true,
              },
            },
          },
        },
      },
    });

    if (!user || !user.isActive) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ success: true, data: user });
  } catch (error) {
    console.error("Me error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
