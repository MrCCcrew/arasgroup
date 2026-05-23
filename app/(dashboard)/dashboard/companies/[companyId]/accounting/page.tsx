import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ companyId: string }>;
}

export default async function AccountingIndexPage({ params }: Props) {
  const { companyId } = await params;
  redirect(`/dashboard/companies/${companyId}/accounting/journal-entries`);
}
