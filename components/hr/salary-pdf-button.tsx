"use client";

import { FileText } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";

interface Props {
  companyId: string;
  batchId: string;
  paymentId: string;
}

export function SalaryPDFButton({ companyId, batchId, paymentId }: Props) {
  const { locale } = useLocale();

  const openPDF = () => {
    const url = `/dashboard/companies/${companyId}/hr/salaries/${batchId}/${paymentId}/pdf?locale=${locale}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <button
      type="button"
      onClick={openPDF}
      className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100"
    >
      <FileText size={14} />
      {locale === "en" ? "PDF" : "PDF"}
    </button>
  );
}
