import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { BankTransferForm } from "@/components/accounting/bank-transfer-form";

interface Props {
  params: Promise<{ companyId: string }>;
}

export default async function NewBankTransferPage({ params }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { companyId } = await params;
  const locale = await getLocale();
  const en = locale === "en";

  const banks = await prisma.bankAccount.findMany({
    where: { companyId, isActive: true },
    select: {
      id: true,
      nameAr: true,
      bankName: true,
      accountNumber: true,
    },
    orderBy: { nameAr: "asc" },
  });

  const t = {
    title: en ? "New Bank Transfer" : "تحويل بنكي جديد",
    subtitle: en ? "Transfer between bank accounts" : "تحويل بين الحسابات البنكية",
  };

  return (
    <div>
      <Header title={t.title} subtitle={t.subtitle} companyId={companyId} />
      <div className="page-container">
        <BankTransferForm companyId={companyId} banks={banks} locale={locale} />
      </div>
    </div>
  );
}
