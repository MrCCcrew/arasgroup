import { prisma } from "@/lib/db";

/**
 * يولد SQL dump كامل لقاعدة البيانات
 */
export async function generateSQLDump(): Promise<string> {
  const lines: string[] = [];

  // Header
  lines.push("-- MySQL dump for Rashid Group ERP");
  lines.push(`-- Generated on: ${new Date().toISOString()}`);
  lines.push("-- ");
  lines.push("");
  lines.push("SET NAMES utf8mb4;");
  lines.push("SET FOREIGN_KEY_CHECKS = 0;");
  lines.push("");

  // تصدير كل جدول
  await exportTable(lines, "Group", await prisma.group.findMany());
  await exportTable(lines, "Company", await prisma.company.findMany());
  await exportTable(lines, "Role", await prisma.role.findMany());
  await exportTable(lines, "User", await prisma.user.findMany());
  await exportTable(lines, "Position", await prisma.position.findMany());
  await exportTable(lines, "Employee", await prisma.employee.findMany());
  await exportTable(lines, "Ticket", await prisma.ticket.findMany());
  await exportTable(lines, "EndOfServiceCalculation", await prisma.endOfServiceCalculation.findMany());
  await exportTable(lines, "Investor", await prisma.investor.findMany());
  await exportTable(lines, "InvestorCharge", await prisma.investorCharge.findMany());
  await exportTable(lines, "InvestorPayment", await prisma.investorPayment.findMany());
  await exportTable(lines, "SalaryCollection", await prisma.salaryCollection.findMany());
  await exportTable(lines, "SalaryCollectionLine", await prisma.salaryCollectionLine.findMany());
  await exportTable(lines, "InvestorClaim", await prisma.investorClaim.findMany());
  await exportTable(lines, "AccountAgreement", await prisma.accountAgreement.findMany());
  await exportTable(lines, "Vehicle", await prisma.vehicle.findMany());
  await exportTable(lines, "CarWashVehicle", await prisma.carWashVehicle.findMany());
  await exportTable(lines, "ExpenseCategory", await prisma.expenseCategory.findMany());
  await exportTable(lines, "Expense", await prisma.expense.findMany());
  await exportTable(lines, "License", await prisma.license.findMany());
  await exportTable(lines, "LicenseSection", await prisma.licenseSection.findMany());
  await exportTable(lines, "LicenseVehicle", await prisma.licenseVehicle.findMany());
  await exportTable(lines, "WorkInjury", await prisma.workInjury.findMany());
  await exportTable(lines, "AnnualBalance", await prisma.annualBalance.findMany());
  await exportTable(lines, "RentReceipt", await prisma.rentReceipt.findMany());
  await exportTable(lines, "DeliveryDriver", await prisma.deliveryDriver.findMany());
  await exportTable(lines, "DeliveryViolation", await prisma.deliveryViolation.findMany());
  await exportTable(lines, "DeliveryAccident", await prisma.deliveryAccident.findMany());
  await exportTable(lines, "DeliveryPayment", await prisma.deliveryPayment.findMany());
  await exportTable(lines, "DeliveryContract", await prisma.deliveryContract.findMany());
  await exportTable(lines, "DeliveryContractRestaurant", await prisma.deliveryContractRestaurant.findMany());
  await exportTable(lines, "DeliveryContractLocation", await prisma.deliveryContractLocation.findMany());
  await exportTable(lines, "DeliveryOrder", await prisma.deliveryOrder.findMany());
  await exportTable(lines, "TalabatImport", await prisma.talabatImport.findMany());
  await exportTable(lines, "TalabatOrderAllocation", await prisma.talabatOrderAllocation.findMany());
  await exportTable(lines, "PlatformIdentifier", await prisma.platformIdentifier.findMany());
  await exportTable(lines, "VehicleIncident", await prisma.vehicleIncident.findMany());
  await exportTable(lines, "KnetTransaction", await prisma.knetTransaction.findMany());
  await exportTable(lines, "KnetSettlement", await prisma.knetSettlement.findMany());
  await exportTable(lines, "AccountingAccount", await prisma.accountingAccount.findMany());
  await exportTable(lines, "FiscalYear", await prisma.fiscalYear.findMany());
  await exportTable(lines, "JournalEntry", await prisma.journalEntry.findMany());
  await exportTable(lines, "JournalEntryLine", await prisma.journalEntryLine.findMany());
  await exportTable(lines, "AssetType", await prisma.assetType.findMany());
  await exportTable(lines, "AssetItem", await prisma.assetItem.findMany());
  await exportTable(lines, "AssetCustody", await prisma.assetCustody.findMany());
  await exportTable(lines, "CompletedTask", await prisma.completedTask.findMany());
  await exportTable(lines, "Reminder", await prisma.reminder.findMany());
  await exportTable(lines, "PushSubscription", await prisma.pushSubscription.findMany());

  // Footer
  lines.push("");
  lines.push("SET FOREIGN_KEY_CHECKS = 1;");
  lines.push("-- Dump completed");

  return lines.join("\n");
}

/**
 * تصدير جدول واحد إلى SQL
 */
async function exportTable(lines: string[], tableName: string, data: any[]) {
  if (!data || data.length === 0) {
    lines.push(`-- Table ${tableName} is empty`);
    lines.push("");
    return;
  }

  lines.push(`--`);
  lines.push(`-- Table: ${tableName}`);
  lines.push(`--`);
  lines.push("");

  // حذف البيانات الحالية
  lines.push(`DELETE FROM \`${tableName}\`;`);
  lines.push("");

  // إدراج البيانات
  const columns = Object.keys(data[0]);
  const columnsList = columns.map(c => `\`${c}\``).join(", ");

  for (const row of data) {
    const values = columns.map(col => {
      const value = row[col];

      if (value === null || value === undefined) {
        return "NULL";
      }

      if (typeof value === "string") {
        // تجنب SQL injection
        const escaped = value
          .replace(/\\/g, "\\\\")
          .replace(/'/g, "\\'")
          .replace(/"/g, '\\"')
          .replace(/\n/g, "\\n")
          .replace(/\r/g, "\\r");
        return `'${escaped}'`;
      }

      if (typeof value === "boolean") {
        return value ? "1" : "0";
      }

      if (value instanceof Date) {
        return `'${value.toISOString().slice(0, 19).replace("T", " ")}'`;
      }

      if (typeof value === "object") {
        // JSON fields
        const escaped = JSON.stringify(value)
          .replace(/\\/g, "\\\\")
          .replace(/'/g, "\\'");
        return `'${escaped}'`;
      }

      return value.toString();
    });

    lines.push(`INSERT INTO \`${tableName}\` (${columnsList}) VALUES (${values.join(", ")});`);
  }

  lines.push("");
}
