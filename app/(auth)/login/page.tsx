import { prisma } from "@/lib/db";
import LoginForm from "./LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ portal?: string; expired?: string }> }) {
  const params = await searchParams;
  const group = await prisma.group.findFirst({
    select: { nameAr: true, nameEn: true, logoUrl: true },
    orderBy: { createdAt: "asc" },
  });

  return <LoginForm logoUrl={group?.logoUrl ?? null} groupNameAr={group?.nameAr ?? "\u0645\u062C\u0645\u0648\u0639\u0629 \u0639\u0628\u062F \u0627\u0644\u0641\u062A\u0627\u062D \u0631\u0627\u0634\u062F"} groupNameEn={group?.nameEn ?? null} portal={params.portal === "car-wash" ? "car-wash" : params.portal === "driver" ? "driver" : undefined} expired={params.expired === "1"} />;
}
