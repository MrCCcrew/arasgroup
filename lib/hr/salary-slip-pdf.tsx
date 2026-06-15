import React from "react";
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";

type SalarySlipLocale = "ar" | "en";

interface SalarySlipItem {
  titleAr: string | null;
  titleEn: string | null;
  amount: number;
}

interface SalarySlipPdfInput {
  locale: SalarySlipLocale;
  companyName: string;
  employeeName: string;
  employeeNumber?: string | null;
  month: number;
  year: number;
  baseAmount: number;
  incentivesAmount: number;
  totalDeductionsAmount: number;
  earnings: SalarySlipItem[];
  deductions: SalarySlipItem[];
  netAmount: number;
  attendanceDays?: number | null;
  evaluationScore?: number | null;
  targetOrders?: number | null;
  actualOrders?: number | null;
  walletAmount?: number | null;
  amountDeliveredByDriver?: number | null;
  notes?: string | null;
}

const MONTHS_AR = [
  "\u064a\u0646\u0627\u064a\u0631",
  "\u0641\u0628\u0631\u0627\u064a\u0631",
  "\u0645\u0627\u0631\u0633",
  "\u0623\u0628\u0631\u064a\u0644",
  "\u0645\u0627\u064a\u0648",
  "\u064a\u0648\u0646\u064a\u0648",
  "\u064a\u0648\u0644\u064a\u0648",
  "\u0623\u063a\u0633\u0637\u0633",
  "\u0633\u0628\u062a\u0645\u0628\u0631",
  "\u0623\u0643\u062a\u0648\u0628\u0631",
  "\u0646\u0648\u0641\u0645\u0628\u0631",
  "\u062f\u064a\u0633\u0645\u0628\u0631",
];

const MONTHS_EN = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontSize: 11,
    fontFamily: "Helvetica",
    color: "#111827",
  },
  header: {
    borderBottomWidth: 2,
    borderBottomColor: "#1d4ed8",
    paddingBottom: 12,
    marginBottom: 18,
    alignItems: "center",
  },
  company: {
    fontSize: 18,
    color: "#1d4ed8",
    fontWeight: 700,
  },
  title: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: 600,
  },
  infoBox: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  label: {
    color: "#6b7280",
    fontWeight: 600,
  },
  value: {
    fontWeight: 500,
  },
  section: {
    fontSize: 12,
    fontWeight: 700,
    marginTop: 10,
    marginBottom: 8,
  },
  table: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 12,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  cellDesc: {
    flex: 1,
    padding: 8,
  },
  cellAmount: {
    width: 140,
    padding: 8,
    textAlign: "right",
  },
  totalRow: {
    flexDirection: "row",
    backgroundColor: "#1d4ed8",
    color: "#ffffff",
    marginTop: 10,
  },
  totalCellDesc: {
    flex: 1,
    padding: 10,
    fontWeight: 700,
  },
  totalCellAmount: {
    width: 140,
    padding: 10,
    textAlign: "right",
    fontWeight: 700,
  },
  footer: {
    marginTop: 18,
    textAlign: "center",
    color: "#6b7280",
    fontSize: 9,
  },
  metaGrid: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    marginBottom: 14,
  },
  metaHeader: {
    backgroundColor: "#f3f4f6",
    padding: 8,
    fontWeight: 700,
  },
  metaBody: {
    padding: 10,
  },
});

function formatAmount(amount: number, locale: SalarySlipLocale) {
  const value = amount.toLocaleString(locale === "en" ? "en-US" : "ar-KW", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
  return locale === "en" ? `KWD ${value}` : `${value} \u062f.\u0643`;
}

function localizedMonth(month: number, locale: SalarySlipLocale) {
  return locale === "en" ? MONTHS_EN[month - 1] : MONTHS_AR[month - 1];
}

function formatNumber(value: number, locale: SalarySlipLocale, digits = 0) {
  return value.toLocaleString(locale === "en" ? "en-US" : "ar-KW", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function SalarySlipDocument(input: SalarySlipPdfInput) {
  const isEn = input.locale === "en";
  const dir: "ltr" | "rtl" = isEn ? "ltr" : "rtl";
  const details = [
    input.attendanceDays != null
      ? {
          labelAr: "\u0623\u064a\u0627\u0645 \u0627\u0644\u062d\u0636\u0648\u0631",
          labelEn: "Attendance days",
          value: formatNumber(input.attendanceDays, input.locale, 1),
        }
      : null,
    input.evaluationScore != null
      ? {
          labelAr: "\u0627\u0644\u062a\u0642\u064a\u064a\u0645",
          labelEn: "Evaluation",
          value: formatNumber(input.evaluationScore, input.locale, 1),
        }
      : null,
    input.targetOrders != null
      ? {
          labelAr: "\u0627\u0644\u062a\u0627\u0631\u062c\u062a",
          labelEn: "Target orders",
          value: formatNumber(input.targetOrders, input.locale),
        }
      : null,
    input.actualOrders != null
      ? {
          labelAr: "\u0627\u0644\u0637\u0644\u0628\u0627\u062a \u0627\u0644\u0641\u0639\u0644\u064a\u0629",
          labelEn: "Actual orders",
          value: formatNumber(input.actualOrders, input.locale),
        }
      : null,
    input.walletAmount != null
      ? {
          labelAr: "\u0627\u0644\u0645\u062d\u0641\u0638\u0629",
          labelEn: "Wallet amount",
          value: formatAmount(input.walletAmount, input.locale),
        }
      : null,
    input.amountDeliveredByDriver != null
      ? {
          labelAr: "\u0627\u0644\u0645\u0628\u0644\u063a \u0627\u0644\u0645\u0633\u0644\u0645",
          labelEn: "Delivered amount",
          value: formatAmount(input.amountDeliveredByDriver, input.locale),
        }
      : null,
    input.notes?.trim()
      ? { labelAr: "\u0645\u0644\u0627\u062d\u0638\u0627\u062a", labelEn: "Notes", value: input.notes.trim() }
      : null,
  ].filter(Boolean) as Array<{ labelAr: string; labelEn: string; value: string }>;

  return (
    <Document title={isEn ? "Salary Slip" : "\u0642\u0633\u064a\u0645\u0629 \u0631\u0627\u062a\u0628"} language={isEn ? "en" : "ar"}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.company}>{input.companyName}</Text>
          <Text style={styles.title}>{isEn ? "Salary Slip" : "\u0642\u0633\u064a\u0645\u0629 \u0631\u0627\u062a\u0628"}</Text>
        </View>

        <View style={styles.infoBox}>
          <View style={styles.infoRow}>
            <Text style={styles.label}>{isEn ? "Employee" : "\u0627\u0644\u0645\u0648\u0638\u0641"}</Text>
            <Text style={styles.value}>{input.employeeName}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>{isEn ? "Employee No." : "\u0631\u0642\u0645 \u0627\u0644\u0645\u0648\u0638\u0641"}</Text>
            <Text style={styles.value}>{input.employeeNumber || "-"}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>{isEn ? "Period" : "\u0627\u0644\u0641\u062a\u0631\u0629"}</Text>
            <Text style={styles.value}>{`${localizedMonth(input.month, input.locale)} ${input.year}`}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>{isEn ? "Base salary" : "\u0627\u0644\u0631\u0627\u062a\u0628 \u0627\u0644\u0623\u0633\u0627\u0633\u064a"}</Text>
            <Text style={styles.value}>{formatAmount(input.baseAmount, input.locale)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>{isEn ? "Incentives & additions" : "\u0627\u0644\u062d\u0648\u0627\u0641\u0632 \u0648\u0627\u0644\u0625\u0636\u0627\u0641\u0627\u062a"}</Text>
            <Text style={styles.value}>{formatAmount(input.incentivesAmount, input.locale)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>{isEn ? "Total deductions" : "\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u062e\u0635\u0648\u0645\u0627\u062a"}</Text>
            <Text style={styles.value}>{formatAmount(input.totalDeductionsAmount, input.locale)}</Text>
          </View>
        </View>

        {details.length > 0 && (
          <View style={styles.metaGrid}>
            <Text style={styles.metaHeader}>{isEn ? "Additional details" : "\u062a\u0641\u0627\u0635\u064a\u0644 \u0625\u0636\u0627\u0641\u064a\u0629"}</Text>
            <View style={styles.metaBody}>
              {details.map((detail, index) => (
                <View key={`detail-${index}`} style={styles.infoRow}>
                  <Text style={styles.label}>{isEn ? detail.labelEn : detail.labelAr}</Text>
                  <Text style={styles.value}>{detail.value}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <Text style={styles.section}>{isEn ? "Earnings" : "\u0627\u0644\u0627\u0633\u062a\u062d\u0642\u0627\u0642\u0627\u062a"}</Text>
        <View style={styles.table}>
          <View style={[styles.tableHeader, { flexDirection: dir === "rtl" ? "row-reverse" : "row" }]}>
            <Text style={styles.cellDesc}>{isEn ? "Description" : "\u0627\u0644\u0628\u064a\u0627\u0646"}</Text>
            <Text style={styles.cellAmount}>{isEn ? "Amount" : "\u0627\u0644\u0645\u0628\u0644\u063a"}</Text>
          </View>
          {input.earnings.map((item, index) => (
            <View
              key={`earning-${index}`}
              style={[styles.tableRow, { flexDirection: dir === "rtl" ? "row-reverse" : "row" }]}
            >
              <Text style={styles.cellDesc}>{isEn ? item.titleEn || item.titleAr || "-" : item.titleAr || item.titleEn || "-"}</Text>
              <Text style={styles.cellAmount}>{formatAmount(item.amount, input.locale)}</Text>
            </View>
          ))}
        </View>

        {input.deductions.length > 0 && (
          <>
            <Text style={styles.section}>{isEn ? "Deductions" : "\u0627\u0644\u062e\u0635\u0648\u0645\u0627\u062a"}</Text>
            <View style={styles.table}>
              <View style={[styles.tableHeader, { flexDirection: dir === "rtl" ? "row-reverse" : "row" }]}>
                <Text style={styles.cellDesc}>{isEn ? "Description" : "\u0627\u0644\u0628\u064a\u0627\u0646"}</Text>
                <Text style={styles.cellAmount}>{isEn ? "Amount" : "\u0627\u0644\u0645\u0628\u0644\u063a"}</Text>
              </View>
              {input.deductions.map((item, index) => (
                <View
                  key={`deduction-${index}`}
                  style={[styles.tableRow, { flexDirection: dir === "rtl" ? "row-reverse" : "row" }]}
                >
                  <Text style={styles.cellDesc}>{isEn ? item.titleEn || item.titleAr || "-" : item.titleAr || item.titleEn || "-"}</Text>
                  <Text style={styles.cellAmount}>{formatAmount(item.amount, input.locale)}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <View style={[styles.totalRow, { flexDirection: dir === "rtl" ? "row-reverse" : "row" }]}>
          <Text style={styles.totalCellDesc}>{isEn ? "Net Salary" : "\u0635\u0627\u0641\u064a \u0627\u0644\u0631\u0627\u062a\u0628"}</Text>
          <Text style={styles.totalCellAmount}>{formatAmount(input.netAmount, input.locale)}</Text>
        </View>

        <Text style={styles.footer}>
          {isEn
            ? "Computer-generated document. No signature required."
            : "\u0648\u062b\u064a\u0642\u0629 \u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a\u0629. \u0644\u0627 \u062d\u0627\u062c\u0629 \u0644\u0644\u062a\u0648\u0642\u064a\u0639."}
        </Text>
      </Page>
    </Document>
  );
}

export async function renderSalarySlipPdfBuffer(input: SalarySlipPdfInput) {
  return renderToBuffer(<SalarySlipDocument {...input} />);
}
