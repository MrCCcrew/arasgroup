import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ companyId: string }>;
}

export default async function CarWashIndexPage({ params }: Props) {
  const { companyId } = await params;
  redirect(`/dashboard/companies/${companyId}/car-wash/operations`);
}
