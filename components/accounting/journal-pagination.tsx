import Link from "next/link";
import { journalListHref, journalPageNumbers } from "@/lib/accounting/journal-list";

export function JournalPagination({ companyId, page, total, status, search, month, en }: {
  companyId: string; page: number; total: number; status?: string; search?: string; month?: string; en: boolean;
}) {
  const totalPages = Math.max(1, Math.ceil(total / 20));
  if (totalPages <= 1) return null;
  const pages = journalPageNumbers(page, totalPages);
  const href = (next: number) => journalListHref(companyId, { page: next, status, search, month });
  const button = "inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-lg border px-3 text-sm hover:bg-muted";
  return <nav aria-label={en ? "Journal pages" : "صفحات القيود"} className="flex flex-wrap items-center justify-center gap-2 rounded-xl border bg-card p-3">
    <p className="w-full text-center text-sm text-muted-foreground">{en ? `Page ${page} of ${totalPages} · ${total} entries` : `صفحة ${page} من ${totalPages} · ${total} قيد`}</p>
    {page > 1 ? <Link className={button} href={href(page - 1)}>{en ? "Previous" : "السابق"}</Link> : <span aria-disabled="true" className={`${button} opacity-40`}>{en ? "Previous" : "السابق"}</span>}
    {pages.map((n, i) => <span key={n} className="inline-flex items-center gap-2">
      {i > 0 && n - pages[i - 1] > 1 && <span aria-hidden="true">…</span>}
      <Link href={href(n)} aria-current={n === page ? "page" : undefined} className={`${button} ${n === page ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""}`}>{n}</Link>
    </span>)}
    {page < totalPages ? <Link className={button} href={href(page + 1)}>{en ? "Next" : "التالي"}</Link> : <span aria-disabled="true" className={`${button} opacity-40`}>{en ? "Next" : "التالي"}</span>}
  </nav>;
}
