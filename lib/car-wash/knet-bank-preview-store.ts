import type { NbkPreviewRow } from "@/lib/owner-management/nbk-parser";

export type CarWashKnetPreviewRow = NbkPreviewRow & {
  vehicleId?: string;
  vehicleCode?: string;
  status: "MATCHED" | "UNMATCHED" | "INVALID";
};

type Preview = { companyId: string; userId: string; rows: CarWashKnetPreviewRow[]; expiresAt: number };
const previews = new Map<string, Preview>();

export function saveCarWashKnetPreview(token: string, preview: Preview) { previews.set(token, preview); }
export function getCarWashKnetPreview(token: string, companyId: string, userId: string) {
  const preview = previews.get(token);
  return preview && preview.expiresAt >= Date.now() && preview.companyId === companyId && preview.userId === userId ? preview : null;
}
export function takeCarWashKnetPreview(token: string, companyId: string, userId: string) {
  const preview = getCarWashKnetPreview(token, companyId, userId);
  if (preview) previews.delete(token);
  return preview;
}
