import { prisma } from "@/lib/db";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  // Fetch the first group to get the logo and name
  const group = await prisma.group.findFirst({
    select: { nameAr: true, nameEn: true, logoUrl: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <LoginForm
      logoUrl={group?.logoUrl ?? null}
      groupNameAr={group?.nameAr ?? "مجموعة عبد الفتاح راشد"}
      groupNameEn={group?.nameEn ?? null}
    />
  );
}
