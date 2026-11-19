import { Prisma } from "@prisma/client";
import { createAdvanceSalaryJournal } from "@/lib/hr/employee-advances";
import { discardLinkedJournalEntry } from "@/lib/accounting/journal-engine";

const INCENTIVE_RATE = 0.5;

function round3(value: number) {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

function orderAmounts(actualOrders: number, targetOrders: number) {
  const difference = actualOrders - targetOrders;
  return {
    incentive: difference > 0 ? round3(difference * INCENTIVE_RATE) : 0,
    targetDeduction: difference < 0 ? round3(-difference * INCENTIVE_RATE) : 0,
  };
}

/**
 * Refreshes only DRAFT payroll batches after a Talabat report is recalculated.
 * Approved and paid payrolls are deliberately immutable: changing them would
 * alter an approved payment and its accounting entry.
 */
export async function refreshDraftDeliverySalaryOrders(
  tx: Prisma.TransactionClient,
  input: {
    companyId: string;
    month: number;
    year: number;
    userId: string;
    ordersByDriverId: Map<string, number>;
  },
) {
  const batches = await tx.salaryBatch.findMany({
    where: { companyId: input.companyId, month: input.month, year: input.year, status: "DRAFT" },
    include: {
      payments: {
        include: { employee: { select: { type: true, driver: { select: { id: true, payrollMode: true, calculatedOrderRate: true, monthlyVehicleRent: true, monthlyHousingDeduction: true } } } } },
      },
      items: true,
    },
  });

  let refreshedBatches = 0;
  for (const batch of batches) {
    const updates = batch.payments.map((payment) => {
      const driverId = payment.employee.driver?.id;
      if (!driverId) return null;

      const actualOrders = Math.round(input.ordersByDriverId.get(driverId) ?? 0);
      const targetOrders = payment.targetOrders ?? 0;
      const usesOrderRate = payment.employee.driver?.payrollMode === "CALCULATED_ORDER_RATE";
      const old = orderAmounts(payment.actualOrders ?? 0, targetOrders);
      const next = orderAmounts(actualOrders, targetOrders);
      const incentive = usesOrderRate ? 0 : Math.max(0, round3(Number(payment.incentives) - old.incentive + next.incentive));
      const storedTargetDeduction = round3(batch.items
        .filter((item) => item.employeeId === payment.employeeId && item.type === "TARGET_DEDUCTION")
        .reduce((sum, item) => sum + Number(item.amount), 0));
      const oldVehicleRent = round3(batch.items.filter((item) => item.employeeId === payment.employeeId && item.type === "VEHICLE_RENT_DEDUCTION").reduce((sum, item) => sum + Number(item.amount), 0));
      const oldHousing = round3(batch.items.filter((item) => item.employeeId === payment.employeeId && item.type === "HOUSING_DEDUCTION").reduce((sum, item) => sum + Number(item.amount), 0));
      const vehicleRent = usesOrderRate ? Number(payment.employee.driver?.monthlyVehicleRent ?? 130) : oldVehicleRent;
      const housing = usesOrderRate ? Number(payment.employee.driver?.monthlyHousingDeduction ?? 30) : oldHousing;
      const deductions = Math.max(0, round3(Number(payment.deductions) - storedTargetDeduction - oldVehicleRent - oldHousing + (usesOrderRate ? vehicleRent + housing : next.targetDeduction + oldVehicleRent + oldHousing)));
      const baseAmount = usesOrderRate ? round3(actualOrders * Number(payment.employee.driver?.calculatedOrderRate ?? 0.95)) : Number(payment.baseAmount);
      const netAmount = round3(
        baseAmount + incentive + Number(payment.additionalEarnings) - deductions,
      );

      return { payment, actualOrders, baseAmount, incentive, targetDeduction: usesOrderRate ? 0 : next.targetDeduction, vehicleRent, housing, deductions, netAmount };
    }).filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    if (!updates.length) continue;

    for (const update of updates) {
      await tx.salaryPayment.update({
        where: { id: update.payment.id },
        data: {
          actualOrders: update.actualOrders,
          baseAmount: update.baseAmount,
          incentives: update.incentive,
          deductions: update.deductions,
          netAmount: update.netAmount,
        },
      });
      await tx.salaryItem.updateMany({
        where: { batchId: batch.id, employeeId: update.payment.employeeId, type: "INCENTIVE" },
        data: { amount: update.incentive },
      });
      if (update.targetDeduction > 0) {
        const targetItem = await tx.salaryItem.findFirst({
          where: { batchId: batch.id, employeeId: update.payment.employeeId, type: "TARGET_DEDUCTION" },
          select: { id: true },
        });
        if (targetItem) {
          await tx.salaryItem.update({ where: { id: targetItem.id }, data: { amount: update.targetDeduction } });
        } else {
          await tx.salaryItem.create({
            data: {
              batchId: batch.id,
              salaryPaymentId: update.payment.id,
              employeeId: update.payment.employeeId,
              type: "TARGET_DEDUCTION",
              category: "DEDUCTION",
              titleAr: "خصم تارجيت",
              titleEn: "Target Deduction",
              amount: update.targetDeduction,
            },
          });
        }
      } else {
        await tx.salaryItem.deleteMany({
          where: { batchId: batch.id, employeeId: update.payment.employeeId, type: "TARGET_DEDUCTION" },
        });
      }
      for (const [type, amount, titleAr, titleEn] of [
        ["VEHICLE_RENT_DEDUCTION", update.vehicleRent, "إيجار السيارة", "Vehicle rent"],
        ["HOUSING_DEDUCTION", update.housing, "بدل السكن", "Housing deduction"],
      ] as const) {
        if (amount > 0) {
          const item = await tx.salaryItem.findFirst({ where: { batchId: batch.id, employeeId: update.payment.employeeId, type }, select: { id: true } });
          if (item) await tx.salaryItem.update({ where: { id: item.id }, data: { amount } });
          else await tx.salaryItem.create({ data: { batchId: batch.id, salaryPaymentId: update.payment.id, employeeId: update.payment.employeeId, type, category: "DEDUCTION", titleAr, titleEn, amount } });
        } else await tx.salaryItem.deleteMany({ where: { batchId: batch.id, employeeId: update.payment.employeeId, type } });
      }
    }

    const refreshedPayments = await tx.salaryPayment.findMany({ where: { batchId: batch.id } });
    const totalGross = round3(refreshedPayments.reduce(
      (sum, payment) => sum + Number(payment.baseAmount) + Number(payment.incentives) + Number(payment.additionalEarnings), 0,
    ));
    const totalNet = round3(refreshedPayments.reduce((sum, payment) => sum + Number(payment.netAmount), 0));
    const refreshedItems = await tx.salaryItem.findMany({ where: { batchId: batch.id } });
    const violationRecoveries = refreshedItems
      .filter((item) => item.sourceType === "DRIVER_VIOLATION")
      .map((item) => ({ employeeId: item.employeeId ?? "", amount: Number(item.amount) }))
      .filter((item) => item.employeeId && item.amount > 0);

    await discardLinkedJournalEntry(tx, batch.journalEntryId, {
      userId: input.userId,
      reasonAr: "تم تحديث طلبات السائقين من تقرير طلبات قبل ترحيل الرواتب",
    });
    const journal = await createAdvanceSalaryJournal(
      tx,
      input.companyId,
      input.userId,
      batch.id,
      input.month,
      input.year,
      totalNet,
      refreshedPayments.reduce((sum, payment) => sum + Number(payment.advanceDeduction), 0),
      refreshedPayments.map((payment) => ({ employeeId: payment.employeeId, advanceDeduction: Number(payment.advanceDeduction) })),
      violationRecoveries,
    );
    await tx.salaryBatch.update({
      where: { id: batch.id },
      data: { totalGross, totalNet, journalEntryId: journal.id },
    });
    refreshedBatches += 1;
  }

  return refreshedBatches;
}

/** Apply a newly enabled order-rate payroll rule to already-open draft batches. */
export async function applyOrderRateToDraftSalaryPayments(
  tx: Prisma.TransactionClient,
  input: { companyId: string; employeeId: string; driverId: string; rate: number; vehicleRent: number; housing: number; userId: string },
) {
  const rows = await tx.salaryPayment.findMany({
    where: { employeeId: input.employeeId, batch: { companyId: input.companyId, status: "DRAFT" } },
    include: { batch: { select: { id: true, month: true, year: true, journalEntryId: true } }, items: true },
  });
  const batchIds = new Set<string>();
  for (const payment of rows) {
    const amountFor = (type: string) => round3(payment.items.filter(item => item.type === type).reduce((sum, item) => sum + Number(item.amount), 0));
    const oldFood = amountFor("FOOD_ALLOWANCE");
    const oldVehicleRent = amountFor("VEHICLE_RENT_DEDUCTION");
    const oldHousing = amountFor("HOUSING_DEDUCTION");
    const baseAmount = round3((payment.actualOrders ?? 0) * input.rate);
    const additionalEarnings = Math.max(0, round3(Number(payment.additionalEarnings) - oldFood));
    const deductions = Math.max(0, round3(Number(payment.deductions) - oldVehicleRent - oldHousing + input.vehicleRent + input.housing));
    const netAmount = round3(baseAmount + additionalEarnings - deductions);
    await tx.salaryPayment.update({ where: { id: payment.id }, data: { baseAmount, incentives: 0, additionalEarnings, deductions, netAmount } });
    await tx.salaryItem.deleteMany({ where: { salaryPaymentId: payment.id, type: { in: ["FOOD_ALLOWANCE", "INCENTIVE", "TARGET_DEDUCTION", "VEHICLE_RENT_DEDUCTION", "HOUSING_DEDUCTION"] } } });
    await tx.salaryItem.updateMany({ where: { salaryPaymentId: payment.id, type: "BASE_SALARY" }, data: { amount: baseAmount } });
    await tx.salaryItem.createMany({ data: [
      { batchId: payment.batchId, salaryPaymentId: payment.id, employeeId: input.employeeId, type: "VEHICLE_RENT_DEDUCTION", category: "DEDUCTION", titleAr: "إيجار السيارة", titleEn: "Vehicle rent", amount: input.vehicleRent },
      { batchId: payment.batchId, salaryPaymentId: payment.id, employeeId: input.employeeId, type: "HOUSING_DEDUCTION", category: "DEDUCTION", titleAr: "بدل السكن", titleEn: "Housing deduction", amount: input.housing },
    ].filter(item => Number(item.amount) > 0) });
    batchIds.add(payment.batchId);
  }
  for (const batchId of batchIds) {
    const batch = rows.find(row => row.batchId === batchId)!.batch;
    const payments = await tx.salaryPayment.findMany({ where: { batchId } });
    const items = await tx.salaryItem.findMany({ where: { batchId } });
    const totalGross = round3(payments.reduce((sum, payment) => sum + Number(payment.baseAmount) + Number(payment.incentives) + Number(payment.additionalEarnings), 0));
    const totalNet = round3(payments.reduce((sum, payment) => sum + Number(payment.netAmount), 0));
    const violationRecoveries = items.filter(item => item.sourceType === "DRIVER_VIOLATION" && item.employeeId).map(item => ({ employeeId: item.employeeId!, amount: Number(item.amount) }));
    await discardLinkedJournalEntry(tx, batch.journalEntryId, { userId: input.userId, reasonAr: "تم تطبيق نظام قيمة الطلب المحسوب على دفعة رواتب مسودة" });
    const journal = await createAdvanceSalaryJournal(tx, input.companyId, input.userId, batchId, batch.month, batch.year, totalNet, payments.reduce((sum, payment) => sum + Number(payment.advanceDeduction), 0), payments.map(payment => ({ employeeId: payment.employeeId, advanceDeduction: Number(payment.advanceDeduction) })), violationRecoveries);
    await tx.salaryBatch.update({ where: { id: batchId }, data: { totalGross, totalNet, journalEntryId: journal.id } });
  }
  return batchIds.size;
}
