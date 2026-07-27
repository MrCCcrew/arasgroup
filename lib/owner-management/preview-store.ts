import type { NbkPreviewRow } from "./nbk-parser";
export type StoredPreviewRow = NbkPreviewRow & { status: string; partnerId?: string; partnerName?: string };
type Preview = { companyId: string; userId: string; fileName: string; bytes: Buffer; pages: string[]; rows: StoredPreviewRow[]; expiresAt: number };
const previews = new Map<string, Preview>();
export function savePreview(token: string, preview: Preview) { previews.set(token, preview); }
export function getPreview(token: string, companyId: string, userId: string) { const preview = previews.get(token); return preview && preview.expiresAt >= Date.now() && preview.companyId === companyId && preview.userId === userId ? preview : null; }
export function takePreview(token: string, companyId: string, userId: string) { const preview = previews.get(token); if (!preview || preview.expiresAt < Date.now() || preview.companyId !== companyId || preview.userId !== userId) return null; previews.delete(token); return preview; }
