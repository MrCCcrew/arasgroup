import { getSession } from "@/lib/auth/session";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// كلمة السر المطلوبة للاستعادة
const RESTORE_PASSWORD = "T@mer2026";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.isSuperAdmin) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    // قراءة البيانات من FormData
    const formData = await request.formData();
    const password = formData.get("password") as string;
    const file = formData.get("file") as File;

    // التحقق من كلمة السر
    if (password !== RESTORE_PASSWORD) {
      return NextResponse.json(
        { error: "كلمة السر غير صحيحة" },
        { status: 401 }
      );
    }

    if (!file) {
      return NextResponse.json(
        { error: "لم يتم رفع ملف النسخة الاحتياطية" },
        { status: 400 }
      );
    }

    // التحقق من نوع الملف
    if (!file.name.endsWith('.json')) {
      return NextResponse.json(
        { error: "يجب أن يكون الملف بصيغة .json" },
        { status: 400 }
      );
    }

    // قراءة محتوى الملف
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const jsonData = buffer.toString('utf-8');

    let backupData;
    try {
      backupData = JSON.parse(jsonData);
    } catch (error) {
      return NextResponse.json(
        { error: "تنسيق الملف غير صحيح" },
        { status: 400 }
      );
    }

    // التحقق من البيانات الوصفية
    if (!backupData.metadata || !backupData.metadata.exportDate) {
      return NextResponse.json(
        { error: "ملف النسخة الاحتياطية تالف أو غير صالح" },
        { status: 400 }
      );
    }

    // حذف جميع البيانات الحالية (بترتيب عكسي لتجنب مشاكل المفاتيح الأجنبية)
    await prisma.$transaction(async (tx) => {
      // حذف البيانات بالترتيب الصحيح
      await tx.pushSubscription.deleteMany();
      await tx.reminder.deleteMany();
      await tx.completedTask.deleteMany();

      await tx.assetCustody.deleteMany();
      await tx.assetItem.deleteMany();
      await tx.assetType.deleteMany();

      await tx.journalEntryLine.deleteMany();
      await tx.journalEntry.deleteMany();
      await tx.fiscalYear.deleteMany();
      await tx.accountingAccount.deleteMany();

      await tx.knetSettlement.deleteMany();
      await tx.knetTransaction.deleteMany();

      await tx.vehicleIncident.deleteMany();
      await tx.platformIdentifier.deleteMany();
      await tx.talabatOrderAllocation.deleteMany();
      await tx.talabatImport.deleteMany();
      await tx.deliveryOrder.deleteMany();
      await tx.deliveryContractLocation.deleteMany();
      await tx.deliveryContractRestaurant.deleteMany();
      await tx.deliveryContract.deleteMany();
      await tx.deliveryPayment.deleteMany();
      await tx.deliveryAccident.deleteMany();
      await tx.deliveryViolation.deleteMany();
      await tx.deliveryDriver.deleteMany();

      await tx.rentReceipt.deleteMany();
      await tx.annualBalance.deleteMany();
      await tx.workInjury.deleteMany();
      await tx.licenseVehicle.deleteMany();
      await tx.licenseSection.deleteMany();
      await tx.license.deleteMany();

      await tx.expense.deleteMany();
      await tx.expenseCategory.deleteMany();

      await tx.carWashVehicle.deleteMany();
      await tx.vehicle.deleteMany();

      await tx.accountAgreement.deleteMany();
      await tx.investorClaim.deleteMany();
      await tx.salaryCollectionLine.deleteMany();
      await tx.salaryCollection.deleteMany();
      await tx.investorPayment.deleteMany();
      await tx.investorCharge.deleteMany();
      await tx.investor.deleteMany();

      await tx.endOfServiceCalculation.deleteMany();
      await tx.ticket.deleteMany();
      await tx.position.deleteMany();
      await tx.employee.deleteMany();

      // حذف الأدوار والمستخدمين
      await tx.user.updateMany({
        data: { roles: { set: [] } }
      });
      await tx.role.deleteMany();
      await tx.user.deleteMany();

      await tx.company.deleteMany();
      await tx.group.deleteMany();
    });

    // استعادة البيانات من النسخة الاحتياطية
    await prisma.$transaction(async (tx) => {
      // استعادة المجموعات والشركات
      if (backupData.groups?.length) {
        for (const group of backupData.groups) {
          const { companies, ...groupData } = group;
          await tx.group.create({ data: groupData });
        }
      }

      if (backupData.companies?.length) {
        for (const company of backupData.companies) {
          await tx.company.create({ data: company });
        }
      }

      // استعادة الأدوار والمستخدمين
      if (backupData.roles?.length) {
        for (const role of backupData.roles) {
          await tx.role.create({ data: role });
        }
      }

      if (backupData.users?.length) {
        for (const user of backupData.users) {
          const { roles, ...userData } = user;
          await tx.user.create({
            data: {
              ...userData,
              roles: roles ? { connect: roles.map((r: any) => ({ id: r.id })) } : undefined
            }
          });
        }
      }

      // استعادة الموظفين
      if (backupData.positions?.length) {
        for (const position of backupData.positions) {
          await tx.position.create({ data: position });
        }
      }

      if (backupData.employees?.length) {
        for (const employee of backupData.employees) {
          await tx.employee.create({ data: employee });
        }
      }

      if (backupData.tickets?.length) {
        for (const ticket of backupData.tickets) {
          await tx.ticket.create({ data: ticket });
        }
      }

      if (backupData.endOfServiceCalculations?.length) {
        for (const calc of backupData.endOfServiceCalculations) {
          await tx.endOfServiceCalculation.create({ data: calc });
        }
      }

      // استعادة المستثمرين
      if (backupData.investors?.length) {
        for (const investor of backupData.investors) {
          await tx.investor.create({ data: investor });
        }
      }

      if (backupData.investorCharges?.length) {
        for (const charge of backupData.investorCharges) {
          await tx.investorCharge.create({ data: charge });
        }
      }

      if (backupData.investorPayments?.length) {
        for (const payment of backupData.investorPayments) {
          await tx.investorPayment.create({ data: payment });
        }
      }

      if (backupData.salaryCollections?.length) {
        for (const collection of backupData.salaryCollections) {
          await tx.salaryCollection.create({ data: collection });
        }
      }

      if (backupData.salaryCollectionLines?.length) {
        for (const line of backupData.salaryCollectionLines) {
          await tx.salaryCollectionLine.create({ data: line });
        }
      }

      if (backupData.investorClaims?.length) {
        for (const claim of backupData.investorClaims) {
          await tx.investorClaim.create({ data: claim });
        }
      }

      if (backupData.accountAgreements?.length) {
        for (const agreement of backupData.accountAgreements) {
          await tx.accountAgreement.create({ data: agreement });
        }
      }

      // استعادة المركبات
      if (backupData.vehicles?.length) {
        for (const vehicle of backupData.vehicles) {
          await tx.vehicle.create({ data: vehicle });
        }
      }

      if (backupData.carWashVehicles?.length) {
        for (const vehicle of backupData.carWashVehicles) {
          await tx.carWashVehicle.create({ data: vehicle });
        }
      }

      // استعادة المصروفات
      if (backupData.expenseCategories?.length) {
        for (const category of backupData.expenseCategories) {
          await tx.expenseCategory.create({ data: category });
        }
      }

      if (backupData.expenses?.length) {
        for (const expense of backupData.expenses) {
          await tx.expense.create({ data: expense });
        }
      }

      // استعادة التراخيص
      if (backupData.licenses?.length) {
        for (const license of backupData.licenses) {
          await tx.license.create({ data: license });
        }
      }

      if (backupData.licenseSections?.length) {
        for (const section of backupData.licenseSections) {
          await tx.licenseSection.create({ data: section });
        }
      }

      if (backupData.licenseVehicles?.length) {
        for (const vehicle of backupData.licenseVehicles) {
          await tx.licenseVehicle.create({ data: vehicle });
        }
      }

      if (backupData.workInjuries?.length) {
        for (const injury of backupData.workInjuries) {
          await tx.workInjury.create({ data: injury });
        }
      }

      if (backupData.annualBalances?.length) {
        for (const balance of backupData.annualBalances) {
          await tx.annualBalance.create({ data: balance });
        }
      }

      if (backupData.rentReceipts?.length) {
        for (const receipt of backupData.rentReceipts) {
          await tx.rentReceipt.create({ data: receipt });
        }
      }

      // استعادة التوصيل
      if (backupData.deliveryDrivers?.length) {
        for (const driver of backupData.deliveryDrivers) {
          await tx.deliveryDriver.create({ data: driver });
        }
      }

      if (backupData.deliveryViolations?.length) {
        for (const violation of backupData.deliveryViolations) {
          await tx.deliveryViolation.create({ data: violation });
        }
      }

      if (backupData.deliveryAccidents?.length) {
        for (const accident of backupData.deliveryAccidents) {
          await tx.deliveryAccident.create({ data: accident });
        }
      }

      if (backupData.deliveryPayments?.length) {
        for (const payment of backupData.deliveryPayments) {
          await tx.deliveryPayment.create({ data: payment });
        }
      }

      if (backupData.deliveryContracts?.length) {
        for (const contract of backupData.deliveryContracts) {
          await tx.deliveryContract.create({ data: contract });
        }
      }

      if (backupData.deliveryContractRestaurants?.length) {
        for (const restaurant of backupData.deliveryContractRestaurants) {
          await tx.deliveryContractRestaurant.create({ data: restaurant });
        }
      }

      if (backupData.deliveryContractLocations?.length) {
        for (const location of backupData.deliveryContractLocations) {
          await tx.deliveryContractLocation.create({ data: location });
        }
      }

      if (backupData.deliveryOrders?.length) {
        for (const order of backupData.deliveryOrders) {
          await tx.deliveryOrder.create({ data: order });
        }
      }

      if (backupData.talabatImports?.length) {
        for (const talabatImport of backupData.talabatImports) {
          await tx.talabatImport.create({ data: talabatImport });
        }
      }

      if (backupData.talabatOrderAllocations?.length) {
        for (const allocation of backupData.talabatOrderAllocations) {
          await tx.talabatOrderAllocation.create({ data: allocation });
        }
      }

      if (backupData.platformIdentifiers?.length) {
        for (const identifier of backupData.platformIdentifiers) {
          await tx.platformIdentifier.create({ data: identifier });
        }
      }

      if (backupData.vehicleIncidents?.length) {
        for (const incident of backupData.vehicleIncidents) {
          await tx.vehicleIncident.create({ data: incident });
        }
      }

      // استعادة غسيل السيارات
      if (backupData.knetTransactions?.length) {
        for (const transaction of backupData.knetTransactions) {
          await tx.knetTransaction.create({ data: transaction });
        }
      }

      if (backupData.knetSettlements?.length) {
        for (const settlement of backupData.knetSettlements) {
          await tx.knetSettlement.create({ data: settlement });
        }
      }

      // استعادة المحاسبة
      if (backupData.accountingAccounts?.length) {
        for (const account of backupData.accountingAccounts) {
          await tx.accountingAccount.create({ data: account });
        }
      }

      if (backupData.fiscalYears?.length) {
        for (const year of backupData.fiscalYears) {
          await tx.fiscalYear.create({ data: year });
        }
      }

      if (backupData.journalEntries?.length) {
        for (const entry of backupData.journalEntries) {
          await tx.journalEntry.create({ data: entry });
        }
      }

      if (backupData.journalEntryLines?.length) {
        for (const line of backupData.journalEntryLines) {
          await tx.journalEntryLine.create({ data: line });
        }
      }

      // استعادة الأصول
      if (backupData.assetTypes?.length) {
        for (const type of backupData.assetTypes) {
          await tx.assetType.create({ data: type });
        }
      }

      if (backupData.assetItems?.length) {
        for (const item of backupData.assetItems) {
          await tx.assetItem.create({ data: item });
        }
      }

      if (backupData.assetCustodies?.length) {
        for (const custody of backupData.assetCustodies) {
          await tx.assetCustody.create({ data: custody });
        }
      }

      // استعادة المهام والتذكيرات
      if (backupData.completedTasks?.length) {
        for (const task of backupData.completedTasks) {
          await tx.completedTask.create({ data: task });
        }
      }

      if (backupData.reminders?.length) {
        for (const reminder of backupData.reminders) {
          await tx.reminder.create({ data: reminder });
        }
      }

      // استعادة الإشعارات
      if (backupData.pushSubscriptions?.length) {
        for (const subscription of backupData.pushSubscriptions) {
          await tx.pushSubscription.create({ data: subscription });
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: "تمت استعادة النسخة الاحتياطية بنجاح"
    });

  } catch (error) {
    console.error("خطأ في استعادة النسخة الاحتياطية:", error);
    return NextResponse.json(
      { error: "فشل استعادة النسخة الاحتياطية: " + (error instanceof Error ? error.message : "") },
      { status: 500 }
    );
  }
}
