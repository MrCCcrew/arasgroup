export function journalMonthRange(value?: string) {
  if (!value || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value) || Number(value.slice(0, 4)) < 1000) return undefined;
  const start = new Date(`${value}-01T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return { gte: start, lt: end };
}

export function journalPage(value: string | undefined, total: number, pageSize = 20) {
  const requested = value && /^\d+$/.test(value) ? Number(value) : 1;
  return Math.min(Math.max(1, Number.isSafeInteger(requested) ? requested : 1), Math.max(1, Math.ceil(total / pageSize)));
}

export function journalListHref(companyId: string, filters: { page?: number; status?: string; search?: string; month?: string }) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, String(value));
  return `/dashboard/companies/${companyId}/accounting/journal-entries${params.size ? `?${params}` : ""}`;
}

export function journalPageNumbers(page: number, totalPages: number) {
  return [...new Set([1, totalPages, page - 1, page, page + 1].filter(n => n >= 1 && n <= totalPages))].sort((a, b) => a - b);
}
