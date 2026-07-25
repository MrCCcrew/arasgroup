import { redirect } from "next/navigation";

export default async function LegacyDriverTrackingSessionPage(props: { params: Promise<{ companyId: string; sessionId: string }> }) {
  const { companyId, sessionId } = await props.params;
  redirect(`/dashboard/companies/${companyId}/driver-tracking/sessions/${sessionId}`);
}
