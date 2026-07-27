"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Group = { id: string; nameAr: string; nameEn: string | null; companies: Array<{ id: string }> };

export function GroupSwitcher() {
  const router = useRouter(); const pathname = usePathname(); const searchParams = useSearchParams();
  const [groups, setGroups] = useState<Group[]>([]); const [global, setGlobal] = useState(false);
  const currentGroupId = searchParams.get("groupId") ?? "";
  useEffect(() => { fetch("/api/groups").then((response) => response.json()).then((payload) => { if (payload.success) { setGroups(payload.data ?? []); setGlobal(Boolean(payload.hasGlobalAccess)); } }).catch(() => undefined); }, []);
  const change = (value: string) => {
    if (value) localStorage.setItem("dashboard-group-id", value); else localStorage.removeItem("dashboard-group-id");
    const params = new URLSearchParams(searchParams.toString()); if (value) params.set("groupId", value); else params.delete("groupId");
    router.push(`/dashboard${params.size ? `?${params}` : ""}`);
  };
  if (!groups.length) return null;
  return <select aria-label="Group switcher" value={currentGroupId} onChange={(event) => change(event.target.value)} className="max-w-44 rounded-full border bg-background px-3 py-1.5 text-xs text-foreground">
    {global && <option value="">All groups</option>}
    {groups.map((group) => <option key={group.id} value={group.id}>{group.nameEn ?? group.nameAr} ({group.companies.length})</option>)}
  </select>;
}
