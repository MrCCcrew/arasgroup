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
  earnings: SalarySlipItem[];
  deductions: SalarySlipItem[];
  netAmount: number;
}

const MONTHS_AR = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
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
});

function formatAmount(amount: number, locale: SalarySlipLocale) {
  const value = amount.toLocaleString(locale === "en" ? "en-US" : "ar-KW", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
  return locale === "en" ? `KWD ${value}` : `${value} د.ك`;
}

function localizedMonth(month: number, locale: SalarySlipLocale) {
  return locale === "en" ? MONTHS_EN[month - 1] : MONTHS_AR[month - 1];
}

function SalarySlipDocument(input: SalarySlipPdfInput) {
  const isEn = input.locale === "en";
  const dir: "ltr" | "rtl" = isEn ? "ltr" : "rtl";

  return (
    <Document title={isEn ? "Salary Slip" : "قسيمة راتب"} language={isEn ? "en" : "ar"}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.company}>{input.companyName}</Text>
          <Text style={styles.title}>{isEn ? "Salary Slip" : "قسيمة راتب"}</Text>
        </View>

        <View style={styles.infoBox}>
          <View style={styles.infoRow}>
            <Text style={styles.label}>{isEn ? "Employee" : "الموظف"}</Text>
            <Text style={styles.value}>{input.employeeName}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>{isEn ? "Employee No." : "رقم الموظف"}</Text>
            <Text style={styles.value}>{input.employeeNumber || "-"}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>{isEn ? "Period" : "الفترة"}</Text>
            <Text style={styles.value}>{`${localizedMonth(input.month, input.locale)} ${input.year}`}</Text>
          </View>
        </View>

        <Text style={styles.section}>{isEn ? "Earnings" : "الاستحقاقات"}</Text>
        <View style={styles.table}>
          <View style={[styles.tableHeader, { flexDirection: dir === "rtl" ? "row-reverse" : "row" }]}>
            <Text style={styles.cellDesc}>{isEn ? "Description" : "البيان"}</Text>
            <Text style={styles.cellAmount}>{isEn ? "Amount" : "المبلغ"}</Text>
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
            <Text style={styles.section}>{isEn ? "Deductions" : "الخصومات"}</Text>
            <View style={styles.table}>
              <View style={[styles.tableHeader, { flexDirection: dir === "rtl" ? "row-reverse" : "row" }]}>
                <Text style={styles.cellDesc}>{isEn ? "Description" : "البيان"}</Text>
                <Text style={styles.cellAmount}>{isEn ? "Amount" : "المبلغ"}</Text>
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
          <Text style={styles.totalCellDesc}>{isEn ? "Net Salary" : "صافي الراتب"}</Text>
          <Text style={styles.totalCellAmount}>{formatAmount(input.netAmount, input.locale)}</Text>
        </View>

        <Text style={styles.footer}>
          {isEn
            ? "Computer-generated document. No signature required."
            : "وثيقة إلكترونية. لا حاجة للتوقيع."}
        </Text>
      </Page>
    </Document>
  );
}

export async function renderSalarySlipPdfBuffer(input: SalarySlipPdfInput) {
  return renderToBuffer(<SalarySlipDocument {...input} />);
}
