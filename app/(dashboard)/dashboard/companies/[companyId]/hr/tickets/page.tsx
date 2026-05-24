import Link from "next/link";
import { redirect } from "next/navigation";
import { Plane, Plus } from "lucide-react";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { formatDate, formatKWD } from "@/lib/utils";
import { TicketRowActions } from "@/components/hr/ticket-row-actions";

interface Props {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ year?: string; type?: string }>;
}

const TICKET_TYPE_LABELS = {
  ar: {
    ANNUAL_LEAVE: "إجازة سنوية",
    EMERGENCY: "طارئ",
    RESIGNATION: "استقالة",
    END_OF_SERVICE: "نهاية خدمة",
    OTHER: "أخرى",
  },
  en: {
    ANNUAL_LEAVE: "Annual Leave",
    EMERGENCY: "Emergency",
    RESIGNATION: "Resignation",
    END_OF_SERVICE: "End of Service",
    OTHER: "Other",
  },
} as const;

export default async function HrTicketsPage({ params, searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { companyId } = await params;
  const sp = await searchParams;
  const locale = await getLocale();
  const numberLocale = locale === "en" ? "en-US" : "ar-KW";

  const year = sp.year ? Number.parseInt(sp.year, 10) : new Date().getFullYear();
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59);

  const ticketWhere = {
    employee: { companyId },
    createdAt: { gte: yearStart, lte: yearEnd },
    ...(sp.type ? { type: sp.type as keyof typeof TICKET_TYPE_LABELS.ar } : {}),
  };

  const [tickets, investors] = await Promise.all([
    prisma.employeeTicket.findMany({
      where: ticketWhere,
      include: {
        employee: { select: { nameAr: true, nameEn: true, type: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.investor.findMany({
      where: { isActive: true, companies: { some: { id: companyId } } },
      select: { id: true, nameAr: true },
      orderBy: { nameAr: "asc" },
    }),
  ]);

  const totalCost = tickets.reduce((sum, ticket) => sum + Number(ticket.cost ?? 0), 0);
  const companyCost = tickets.filter((ticket) => ticket.paidBy === "COMPANY").reduce((sum, ticket) => sum + Number(ticket.cost ?? 0), 0);
  const investorCost = tickets.filter((ticket) => ticket.paidBy === "INVESTOR").reduce((sum, ticket) => sum + Number(ticket.cost ?? 0), 0);

  return (
    <div>
      <Header
        title={locale === "en" ? "Travel Tickets" : "تذاكر السفر"}
        subtitle={locale === "en" ? `${tickets.length} ticket(s) - ${year}` : `${tickets.length} تذكرة - ${year}`}
        companyId={companyId}
        actions={
          <Link
            href={`/dashboard/companies/${companyId}/hr/tickets/new`}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus size={16} />
            {locale === "en" ? "Add ticket" : "إضافة تذكرة"}
          </Link>
        }
      />

      <div className="page-container space-y-4">
        <form method="get" className="section-card">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Year" : "السنة"}</label>
              <select name="year" defaultValue={year} className="input-field">
                {[2023, 2024, 2025, 2026].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Type" : "النوع"}</label>
              <select name="type" defaultValue={sp.type ?? ""} className="input-field">
                <option value="">{locale === "en" ? "All types" : "كل الأنواع"}</option>
                {Object.entries(TICKET_TYPE_LABELS[locale]).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90">
              {locale === "en" ? "Filter" : "بحث"}
            </button>
          </div>
        </form>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="stat-card">
            <span className="text-sm text-muted-foreground">{locale === "en" ? "Total tickets" : "إجمالي التذاكر"}</span>
            <span className="text-2xl font-bold">{tickets.length}</span>
          </div>
          <div className="stat-card">
            <span className="text-sm text-muted-foreground">{locale === "en" ? "Company cost" : "تكلفة الشركة"}</span>
            <span className="number text-2xl font-bold text-red-600">{formatKWD(companyCost, numberLocale)}</span>
          </div>
          <div className="stat-card">
            <span className="text-sm text-muted-foreground">{locale === "en" ? "Investor cost" : "تكلفة المستثمر"}</span>
            <span className="number text-2xl font-bold text-orange-600">{formatKWD(investorCost, numberLocale)}</span>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <table className="ar-table">
              <thead>
                <tr>
                  <th>{locale === "en" ? "Employee" : "الموظف"}</th>
                  <th>{locale === "en" ? "Ticket type" : "نوع التذكرة"}</th>
                  <th>{locale === "en" ? "Destination" : "الوجهة"}</th>
                  <th>{locale === "en" ? "Travel date" : "تاريخ السفر"}</th>
                  <th>{locale === "en" ? "Return date" : "تاريخ العودة"}</th>
                  <th>{locale === "en" ? "Cost (KWD)" : "التكلفة (د.ك)"}</th>
                  <th>{locale === "en" ? "Paid by" : "يدفعها"}</th>
                  <th>{locale === "en" ? "Notes" : "ملاحظات"}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {tickets.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center text-muted-foreground">
                      <Plane size={32} className="mx-auto mb-2 opacity-40" />
                      {locale === "en" ? `No tickets found in ${year}` : `لا توجد تذاكر في ${year}`}
                    </td>
                  </tr>
                ) : (
                  tickets.map((ticket) => (
                    <tr key={ticket.id} className="hover:bg-muted/10">
                      <td className="font-medium">{locale === "en" ? ticket.employee.nameEn ?? ticket.employee.nameAr : ticket.employee.nameAr}</td>
                      <td>
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                          {TICKET_TYPE_LABELS[locale][ticket.type as keyof typeof TICKET_TYPE_LABELS.ar] ?? ticket.type}
                        </span>
                      </td>
                      <td className="text-sm">{ticket.destination ?? "-"}</td>
                      <td className="text-sm">{ticket.travelDate ? formatDate(ticket.travelDate, numberLocale) : "-"}</td>
                      <td className="text-sm">{ticket.returnDate ? formatDate(ticket.returnDate, numberLocale) : "-"}</td>
                      <td className="number font-medium">{ticket.cost ? formatKWD(Number(ticket.cost), numberLocale) : "-"}</td>
                      <td>
                        {ticket.paidBy === "COMPANY" && (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
                            {locale === "en" ? "Company" : "الشركة"}
                          </span>
                        )}
                        {ticket.paidBy === "INVESTOR" && (
                          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700">
                            {locale === "en" ? "Investor" : "المستثمر"}
                          </span>
                        )}
                        {!ticket.paidBy && <span className="text-xs text-muted-foreground">-</span>}
                      </td>
                      <td className="text-sm text-muted-foreground">{ticket.notes ?? "-"}</td>
                      <td>
                        <TicketRowActions
                          ticketId={ticket.id}
                          type={ticket.type}
                          destination={ticket.destination}
                          travelDate={ticket.travelDate?.toISOString() ?? null}
                          returnDate={ticket.returnDate?.toISOString() ?? null}
                          cost={ticket.cost?.toString() ?? null}
                          paidBy={ticket.paidBy}
                          investorId={ticket.investorId}
                          notes={ticket.notes}
                          investors={investors}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {tickets.length > 0 && (
                <tfoot className="border-t-2 bg-muted/30 font-bold">
                  <tr>
                    <td colSpan={5} className="py-2 text-center">{locale === "en" ? "Total" : "الإجمالي"}</td>
                    <td className="number">{formatKWD(totalCost, numberLocale)}</td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
