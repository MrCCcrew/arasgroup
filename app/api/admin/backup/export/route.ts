import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const session = await getSession();
    if (!session?.isSuperAdmin) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    // جمع جميع البيانات من جميع الجداول
    const data = {
      metadata: {
        exportDate: new Date().toISOString(),
        version: "1.0.0",
      },
      // النظام الأساسي
      groups: await prisma.group.findMany({ include: { companies: true } }),
      companies: await prisma.company.findMany(),
      users: await prisma.user.findMany({ include: { roles: true } }),
      roles: await prisma.role.findMany(),

      // الموظفين
      employees: await prisma.employee.findMany(),
      positions: await prisma.position.findMany(),
      tickets: await prisma.ticket.findMany(),
      endOfServiceCalculations: await prisma.endOfServiceCalculation.findMany(),

      // المستثمرين
      investors: await prisma.investor.findMany(),
      investorCharges: await prisma.investorCharge.findMany(),
      investorPayments: await prisma.investorPayment.findMany(),
      salaryCollections: await prisma.salaryCollection.findMany(),
      salaryCollectionLines: await prisma.salaryCollectionLine.findMany(),
      investorClaims: await prisma.investorClaim.findMany(),
      accountAgreements: await prisma.accountAgreement.findMany(),

      // المركبات
      vehicles: await prisma.vehicle.findMany(),
      carWashVehicles: await prisma.carWashVehicle.findMany(),

      // المصروفات
      expenseCategories: await prisma.expenseCategory.findMany(),
      expenses: await prisma.expense.findMany(),

      // التراخيص
      licenses: await prisma.license.findMany(),
      licenseSections: await prisma.licenseSection.findMany(),
      licenseVehicles: await prisma.licenseVehicle.findMany(),
      workInjuries: await prisma.workInjury.findMany(),
      annualBalances: await prisma.annualBalance.findMany(),
      rentReceipts: await prisma.rentReceipt.findMany(),

      // التوصيل
      deliveryDrivers: await prisma.deliveryDriver.findMany(),
      deliveryViolations: await prisma.deliveryViolation.findMany(),
      deliveryAccidents: await prisma.deliveryAccident.findMany(),
      deliveryPayments: await prisma.deliveryPayment.findMany(),
      deliveryContracts: await prisma.deliveryContract.findMany(),
      deliveryContractRestaurants: await prisma.deliveryContractRestaurant.findMany(),
      deliveryContractLocations: await prisma.deliveryContractLocation.findMany(),
      deliveryOrders: await prisma.deliveryOrder.findMany(),
      talabatImports: await prisma.talabatImport.findMany(),
      talabatOrderAllocations: await prisma.talabatOrderAllocation.findMany(),
      platformIdentifiers: await prisma.platformIdentifier.findMany(),
      vehicleIncidents: await prisma.vehicleIncident.findMany(),

      // غسيل السيارات
      knetTransactions: await prisma.knetTransaction.findMany(),
      knetSettlements: await prisma.knetSettlement.findMany(),

      // المحاسبة
      accountingAccounts: await prisma.accountingAccount.findMany(),
      fiscalYears: await prisma.fiscalYear.findMany(),
      journalEntries: await prisma.journalEntry.findMany(),
      journalEntryLines: await prisma.journalEntryLine.findMany(),

      // الأصول
      assetTypes: await prisma.assetType.findMany(),
      assetItems: await prisma.assetItem.findMany(),
      assetCustodies: await prisma.assetCustody.findMany(),

      // المهام والتذكيرات
      completedTasks: await prisma.completedTask.findMany(),
      reminders: await prisma.reminder.findMany(),

      // الإشعارات
      pushSubscriptions: await prisma.pushSubscription.findMany(),
    };

    // تحويل البيانات إلى JSON
    const jsonData = JSON.stringify(data, null, 2);
    const buffer = Buffer.from(jsonData, 'utf-8');

    // إنشاء اسم ملف فريد بالتاريخ والوقت
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const filename = `backup_${timestamp}.json`;

    // إرجاع الملف
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length.toString(),
      },
    });

  } catch (error) {
    console.error("خطأ في تصدير النسخة الاحتياطية:", error);
    return NextResponse.json(
      { error: "فشل إنشاء النسخة الاحتياطية" },
      { status: 500 }
    );
  }
}
