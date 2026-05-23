import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ companyId: string }>;
}

export default async function DeliveryIndexPage({ params }: Props) {
  const { companyId } = await params;
  redirect(`/dashboard/companies/${companyId}/delivery/daily-orders`);
}
