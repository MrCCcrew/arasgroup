import { redirect } from "next/navigation";
import { PrintControls } from "@/components/ui/print-controls";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { formatDate, formatKWD } from "@/lib/utils";

interface Props {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ year?: string; type?: string; paidBy?: string; search?: string }>;
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

export default async function HrTicketsPrintPage({ params, searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { companyId } = await params;
  const sp = await searchParams;
  const locale = await getLocale();
  const numberLocale = locale === "en" ? "en-US" : "ar-KW";

  const year = sp.year ? Number.parseInt(sp.year, 10) : new Date().getFullYear();
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59);

  const tickets = await prisma.employeeTicket.findMany({
    where: {
      employee: { companyId },
      createdAt: { gte: yearStart, lte: yearEnd },
      ...(sp.type ? { type: sp.type as keyof typeof TICKET_TYPE_LABELS.ar } : {}),
      ...(sp.paidBy ? { paidBy: sp.paidBy as "COMPANY" | "INVESTOR" } : {}),
      ...(sp.search
        ? {
            OR: [
              { destination: { contains: sp.search } },
              { notes: { contains: sp.search } },
              { employee: { nameAr: { contains: sp.search } } },
              { employee: { nameEn: { contains: sp.search } } },
            ],
          }
        : {}),
    },
    include: {
      employee: { select: { nameAr: true, nameEn: true } },
    },
    orderBy: [{ travelDate: "desc" }, { createdAt: "desc" }],
  });
  type TicketPrintRow = typeof tickets[number];

  const totalCost = tickets.reduce((sum: number, ticket: TicketPrintRow) => sum + Number(ticket.cost ?? 0), 0);

  const activeFilters = [
    sp.type ? TICKET_TYPE_LABELS[locale][sp.type as keyof typeof TICKET_TYPE_LABELS.ar] ?? sp.type : null,
    sp.paidBy ? (sp.paidBy === "COMPANY" ? (locale === "en" ? "Company" : "الشركة") : (locale === "en" ? "Investor" : "المستثمر")) : null,
    sp.search ?? null,
  ].filter(Boolean);

  return (
    <div className="min-h-screen bg-white p-8 text-black">
      <PrintControls backHref={`/dashboard/companies/${companyId}/hr/tickets`} />

      <div className="mx-auto max-w-6xl space-y-6">
        <div className="border-b pb-4 text-center">
          <h1 className="text-2xl font-bold">{locale === "en" ? "Travel Tickets Report" : "تقرير تذاكر السفر"}</h1>
          <p className="mt-2 text-sm text-gray-600">
            {locale === "en" ? `Year ${year}` : `السنة ${year}`}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="rounded border p-4">
            <div className="text-sm text-gray-500">{locale === "en" ? "Tickets" : "عدد التذاكر"}</div>
            <div className="mt-1 text-2xl font-bold">{tickets.length}</div>
          </div>
          <div className="rounded border p-4">
            <div className="text-sm text-gray-500">{locale === "en" ? "Total cost" : "إجمالي التكلفة"}</div>
            <div className="mt-1 text-2xl font-bold">{formatKWD(totalCost, numberLocale)}</div>
          </div>
          <div className="rounded border p-4">
            <div className="text-sm text-gray-500">{locale === "en" ? "Filters" : "الفلاتر"}</div>
            <div className="mt-1 text-sm font-medium">{activeFilters.join(" • ") || (locale === "en" ? "None" : "لا يوجد")}</div>
          </div>
        </div>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-2 text-right">{locale === "en" ? "Employee" : "الموظف"}</th>
              <th className="border p-2 text-right">{locale === "en" ? "Type" : "النوع"}</th>
              <th className="border p-2 text-right">{locale === "en" ? "Destination" : "الوجهة"}</th>
              <th className="border p-2 text-right">{locale === "en" ? "Travel" : "السفر"}</th>
              <th className="border p-2 text-right">{locale === "en" ? "Return" : "العودة"}</th>
              <th className="border p-2 text-right">{locale === "en" ? "Paid by" : "جهة الدفع"}</th>
              <th className="border p-2 text-right">{locale === "en" ? "Cost" : "التكلفة"}</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket: TicketPrintRow) => (
              <tr key={ticket.id}>
                <td className="border p-2">{locale === "en" ? ticket.employee.nameEn ?? ticket.employee.nameAr : ticket.employee.nameAr}</td>
                <td className="border p-2">{TICKET_TYPE_LABELS[locale][ticket.type as keyof typeof TICKET_TYPE_LABELS.ar] ?? ticket.type}</td>
                <td className="border p-2">{ticket.destination ?? "-"}</td>
                <td className="border p-2">{ticket.travelDate ? formatDate(ticket.travelDate, numberLocale) : "-"}</td>
                <td className="border p-2">{ticket.returnDate ? formatDate(ticket.returnDate, numberLocale) : "-"}</td>
                <td className="border p-2">
                  {ticket.paidBy === "COMPANY"
                    ? locale === "en" ? "Company" : "الشركة"
                    : ticket.paidBy === "INVESTOR"
                      ? locale === "en" ? "Investor" : "المستثمر"
                      : "-"}
                </td>
                <td className="border p-2">{ticket.cost ? formatKWD(Number(ticket.cost), numberLocale) : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
