"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Clock } from "lucide-react";
import { KnetSettlementRowActions } from "./knet-settlement-row-actions";
import { formatDate, formatKWD } from "@/lib/utils";

interface KnetTransaction {
  id: string;
  amount: any;
  transactionRef: string | null;
  date: Date;
  operation: {
    id: string;
    date: Date;
    totalCash: any;
    totalKnet: any;
    netRevenue: any;
    vehicle: {
      plateNumber: string;
    };
    location: {
      nameAr: string;
    };
    createdAt: Date;
  };
}

interface Settlement {
  id: string;
  settlementDate: Date;
  grossAmount: any;
  commission: any;
  netAmount: any;
  notes: string | null;
  journalEntryId: string | null;
  bankAccountId: string;
  bankAccount: { nameAr: string; nameEn: string | null };
  transactions: { id: string }[];
}

interface BankAccount {
  id: string;
  nameAr: string;
  bankName: string | null;
}

interface Props {
  settlements: Settlement[];
  unsettledTransactions: KnetTransaction[];
  bankAccounts: BankAccount[];
  companyId: string;
  locale: "ar" | "en";
  numberLocale: string;
  month: number;
  year: number;
  monthName: string;
}

export function KnetTabs({
  settlements,
  unsettledTransactions,
  bankAccounts,
  companyId,
  locale,
  numberLocale,
  month,
  year,
  monthName,
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"settlements" | "unsettled">("settlements");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);

  const en = locale === "en";
  const allSelected = unsettledTransactions.length > 0 && selectedIds.length === unsettledTransactions.length;

  const totalGross = settlements.reduce((sum, s) => sum + Number(s.grossAmount), 0);
  const totalCommission = settlements.reduce((sum, s) => sum + Number(s.commission), 0);
  const totalNet = settlements.reduce((sum, s) => sum + Number(s.netAmount), 0);

  const selectedTotal = unsettledTransactions
    .filter((t) => selectedIds.includes(t.id))
    .reduce((sum, t) => sum + Number(t.amount), 0);

  function toggleAll() {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(unsettledTransactions.map((t) => t.id));
    }
  }

  function toggleTransaction(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }

  function handleSettleSelected() {
    if (selectedIds.length === 0) return;
    const params = new URLSearchParams({ transactionIds: selectedIds.join(",") });
    router.push(`/dashboard/companies/${companyId}/car-wash/knet/new?${params}`);
  }

  return (
    <div className="space-y-4">
      {/* Tabs Header */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab("settlements")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "settlements"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {en ? "Completed Settlements" : "التسويات المكتملة"} ({settlements.length})
        </button>
        <button
          onClick={() => setActiveTab("unsettled")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "unsettled"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {en ? "Unsettled Transactions" : "معاملات غير مسواة"} ({unsettledTransactions.length})
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "settlements" ? (
        <>
          {/* Stats */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="stat-card">
              <span className="text-sm text-muted-foreground">{en ? "Settlements count" : "عدد التسويات"}</span>
              <span className="text-2xl font-bold">{settlements.length}</span>
            </div>
            <div className="stat-card">
              <span className="text-sm text-muted-foreground">{en ? "Gross KNET" : "إجمالي KNET"}</span>
              <span className="number text-2xl font-bold">{formatKWD(totalGross, numberLocale)}</span>
            </div>
            <div className="stat-card">
              <span className="text-sm text-muted-foreground">{en ? "Bank commission" : "العمولة البنكية"}</span>
              <span className="number text-2xl font-bold text-red-600">{formatKWD(totalCommission, numberLocale)}</span>
            </div>
            <div className="stat-card">
              <span className="text-sm text-muted-foreground">{en ? "Net received" : "صافي المستلم"}</span>
              <span className="number text-2xl font-bold text-green-600">{formatKWD(totalNet, numberLocale)}</span>
            </div>
          </div>

          {/* Settlements Table */}
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="overflow-x-auto">
              <table className="ar-table">
                <thead>
                  <tr>
                    <th>{en ? "Settlement date" : "تاريخ التسوية"}</th>
                    <th>{en ? "Bank account" : "الحساب البنكي"}</th>
                    <th>{en ? "Transactions count" : "عدد المعاملات"}</th>
                    <th>{en ? "Gross KNET" : "إجمالي KNET"}</th>
                    <th>{en ? "Commission" : "العمولة"}</th>
                    <th>{en ? "Net transfer" : "صافي المحول"}</th>
                    <th>{en ? "Notes" : "ملاحظات"}</th>
                    <th>{en ? "Journal entry" : "القيد"}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {settlements.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-muted-foreground">
                        {en ? `No settlements found for ${monthName} ${year}` : `لا توجد تسويات في ${monthName} ${year}`}
                      </td>
                    </tr>
                  ) : (
                    settlements.map((settlement) => (
                      <tr key={settlement.id} className="hover:bg-muted/10">
                        <td className="text-sm">{formatDate(settlement.settlementDate, numberLocale)}</td>
                        <td className="text-sm">
                          {en ? settlement.bankAccount.nameEn ?? settlement.bankAccount.nameAr : settlement.bankAccount.nameAr}
                        </td>
                        <td className="number text-center">{settlement.transactions.length}</td>
                        <td className="number font-medium">{formatKWD(Number(settlement.grossAmount), numberLocale)}</td>
                        <td className="number text-red-600">{formatKWD(Number(settlement.commission), numberLocale)}</td>
                        <td className="number font-bold text-green-600">{formatKWD(Number(settlement.netAmount), numberLocale)}</td>
                        <td className="text-sm text-muted-foreground">{settlement.notes ?? "-"}</td>
                        <td>
                          {settlement.journalEntryId ? (
                            <CheckCircle size={16} className="mx-auto text-green-500" />
                          ) : (
                            <span className="text-xs text-muted-foreground">{en ? "None" : "لا يوجد"}</span>
                          )}
                        </td>
                        <td>
                          <KnetSettlementRowActions
                            settlementId={settlement.id}
                            settlementDate={settlement.settlementDate.toISOString()}
                            grossAmount={settlement.grossAmount.toString()}
                            commission={settlement.commission.toString()}
                            netAmount={settlement.netAmount.toString()}
                            bankAccountId={settlement.bankAccountId}
                            notes={settlement.notes}
                            bankAccounts={bankAccounts}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {settlements.length > 0 && (
                  <tfoot className="border-t-2 bg-muted/30 font-bold">
                    <tr>
                      <td colSpan={3} className="py-2 text-center">{en ? "Total" : "الإجمالي"}</td>
                      <td className="number">{formatKWD(totalGross, numberLocale)}</td>
                      <td className="number text-red-600">{formatKWD(totalCommission, numberLocale)}</td>
                      <td className="number text-green-600">{formatKWD(totalNet, numberLocale)}</td>
                      <td colSpan={3}></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Bulk Actions */}
          {selectedIds.length > 0 && (
            <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">
                  {en ? `${selectedIds.length} selected` : `${selectedIds.length} محدد`}
                </span>
                <span className="text-sm text-muted-foreground">
                  {en ? "Total:" : "الإجمالي:"} {formatKWD(selectedTotal, numberLocale)}
                </span>
                <button
                  onClick={() => setSelectedIds([])}
                  className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                >
                  {en ? "Clear selection" : "إلغاء التحديد"}
                </button>
              </div>
              <button
                onClick={handleSettleSelected}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <CheckCircle size={16} />
                {en ? "Settle selected" : "تسوية المحدد"}
              </button>
            </div>
          )}

          {/* Unsettled Transactions Table */}
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="overflow-x-auto">
              <table className="ar-table">
                <thead>
                  <tr>
                    <th className="w-12">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleAll}
                        className="cursor-pointer"
                      />
                    </th>
                    <th>{en ? "Date" : "التاريخ"}</th>
                    <th>{en ? "Location" : "الموقع"}</th>
                    <th>{en ? "Vehicle" : "المركبة"}</th>
                    <th>{en ? "Amount" : "المبلغ"}</th>
                    <th>{en ? "Reference #" : "رقم المرجع"}</th>
                  </tr>
                </thead>
                <tbody>
                  {unsettledTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <CheckCircle size={48} className="text-green-500" />
                          <p className="text-lg font-medium text-green-600">
                            {en ? "All transactions are settled!" : "جميع المعاملات مسواة!"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {en ? "No pending KNET transactions" : "لا توجد معاملات KNET معلقة"}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    unsettledTransactions.map((transaction) => (
                      <tr key={transaction.id} className="hover:bg-muted/10">
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(transaction.id)}
                            onChange={() => toggleTransaction(transaction.id)}
                            className="cursor-pointer"
                          />
                        </td>
                        <td className="text-sm">{formatDate(transaction.operation.date, numberLocale)}</td>
                        <td className="text-sm">{transaction.operation.location.nameAr}</td>
                        <td className="text-sm">{transaction.operation.vehicle.plateNumber}</td>
                        <td className="number font-medium text-green-600">{formatKWD(Number(transaction.amount), numberLocale)}</td>
                        <td className="text-xs text-muted-foreground">{transaction.transactionRef ?? "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
