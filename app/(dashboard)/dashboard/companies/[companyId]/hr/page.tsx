import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ companyId: string }>;
}

export default async function HrIndexPage({ params }: Props) {
  const { companyId } = await params;
  redirect(`/dashboard/companies/${companyId}/hr/employees`);
}
