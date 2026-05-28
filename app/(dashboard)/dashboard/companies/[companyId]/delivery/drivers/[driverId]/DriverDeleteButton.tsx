"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";

interface Props {
  driverId: string;
  companyId: string;
  driverName: string;
}

export function DriverDeleteButton({ driverId, companyId, driverName }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm(`هل تريد حذف السائق "${driverName}" نهائياً؟ لا يمكن التراجع عن هذا الإجراء.`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/drivers/${driverId}`, { method: "DELETE" });
      if (res.ok) {
        router.push(`/dashboard/companies/${companyId}/delivery/drivers`);
      } else {
        const data = await res.json();
        alert(data.error ?? "فشل في الحذف");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
    >
      <Trash2 size={15} />
      {loading ? "جارٍ الحذف..." : "حذف"}
    </button>
  );
}
