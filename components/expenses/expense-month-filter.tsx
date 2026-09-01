"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

const MONTHS = {
  ar: ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
} as const;

export function ExpenseMonthFilter({ locale, month }: { locale: "ar" | "en"; month: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function selectMonth(nextMonth: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", nextMonth);
    params.set("year", params.get("year") ?? String(new Date().getFullYear()));
    params.delete("startDate");
    params.delete("endDate");
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <select value={String(month)} onChange={(event) => selectMonth(event.target.value)} className="input-field">
      {MONTHS[locale].map((monthName, index) => <option key={monthName} value={index + 1}>{monthName}</option>)}
    </select>
  );
}
