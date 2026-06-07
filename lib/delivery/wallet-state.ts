import type { Prisma, WalletTransactionType } from "@prisma/client";

const DEBIT_TYPES = new Set<WalletTransactionType>(["CHARGE", "DEDUCTION", "DEDUCTION_PENALTY"]);
const CREDIT_TYPES = new Set<WalletTransactionType>(["DEPOSIT", "SETTLEMENT", "INCENTIVE"]);

export function getWalletBalanceDelta(type: WalletTransactionType, amount: number): number {
  if (DEBIT_TYPES.has(type)) return amount;
  if (CREDIT_TYPES.has(type)) return -amount;
  return 0;
}

export function isWalletCreditType(type: WalletTransactionType): boolean {
  return CREDIT_TYPES.has(type);
}

export function isWalletDebitType(type: WalletTransactionType): boolean {
  return DEBIT_TYPES.has(type);
}

interface DailyOrderWalletChargeLookup {
  dailyOrderId: string;
  driverId: string;
  contractId: string;
  date: Date;
}

interface SyncDailyOrderWalletChargeInput extends DailyOrderWalletChargeLookup {
  amount: number | null | undefined;
  descriptionAr: string;
}

type WalletStateClient = {
  driverWalletTransaction: Prisma.TransactionClient["driverWalletTransaction"];
  driver: Prisma.TransactionClient["driver"];
};

type WalletTransactionClient = {
  driverWalletTransaction: Prisma.TransactionClient["driverWalletTransaction"];
};

export async function recomputeDriverWalletState(tx: WalletStateClient, driverId: string) {
  const transactions = await tx.driverWalletTransaction.findMany({
    where: { driverId },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      type: true,
      amount: true,
      isSettled: true,
      settledAt: true,
    },
  });

  let balance = 0;
  const pendingCharges: Array<{ id: string; remaining: number }> = [];
  const updates: Array<{ id: string; isSettled: boolean; settledAt: Date | null }> = [];
  const settledAt = new Date();

  for (const transaction of transactions) {
    const amount = Number(transaction.amount);
    balance += getWalletBalanceDelta(transaction.type, amount);

    if (isWalletDebitType(transaction.type)) {
      pendingCharges.push({ id: transaction.id, remaining: amount });
      updates.push({ id: transaction.id, isSettled: false, settledAt: null });
      continue;
    }

    if (isWalletCreditType(transaction.type)) {
      let available = amount;
      while (available > 0.0005 && pendingCharges.length > 0) {
        const current = pendingCharges[0];
        const settledAmount = Math.min(current.remaining, available);
        current.remaining -= settledAmount;
        available -= settledAmount;

        if (current.remaining <= 0.0005) {
          const chargeUpdate = updates.find((item) => item.id === current.id);
          if (chargeUpdate) {
            chargeUpdate.isSettled = true;
            chargeUpdate.settledAt = settledAt;
          }
          pendingCharges.shift();
        }
      }

      updates.push({ id: transaction.id, isSettled: true, settledAt });
      continue;
    }

    updates.push({ id: transaction.id, isSettled: false, settledAt: null });
  }

  for (const update of updates) {
    await tx.driverWalletTransaction.update({
      where: { id: update.id },
      data: {
        isSettled: update.isSettled,
        settledAt: update.settledAt,
      },
    });
  }

  await tx.driver.update({
    where: { id: driverId },
    data: { walletBalance: balance },
  });

  return { balance };
}

export async function recomputeDriverWalletStates(tx: WalletStateClient, driverIds: Iterable<string>) {
  const uniqueDriverIds = [...new Set([...driverIds].filter(Boolean))];

  for (const driverId of uniqueDriverIds) {
    await recomputeDriverWalletState(tx, driverId);
  }
}

export async function findDailyOrderWalletCharge(
  tx: WalletTransactionClient,
  lookup: DailyOrderWalletChargeLookup,
) {
  return tx.driverWalletTransaction.findFirst({
    where: {
      OR: [
        { dailyOrderId: lookup.dailyOrderId, type: "CHARGE" },
        {
          driverId: lookup.driverId,
          contractId: lookup.contractId,
          type: "CHARGE",
          date: lookup.date,
          dailyOrderId: null,
        },
      ],
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
}

export async function syncDailyOrderWalletCharge(
  tx: WalletTransactionClient,
  input: SyncDailyOrderWalletChargeInput,
) {
  const existing = await findDailyOrderWalletCharge(tx, input);
  const normalizedAmount = input.amount ?? 0;

  if (normalizedAmount <= 0) {
    if (existing) {
      await tx.driverWalletTransaction.delete({ where: { id: existing.id } });
    }
    return;
  }

  if (existing) {
    await tx.driverWalletTransaction.update({
      where: { id: existing.id },
      data: {
        driverId: input.driverId,
        contractId: input.contractId,
        amount: normalizedAmount,
        date: input.date,
        descriptionAr: input.descriptionAr,
        dailyOrderId: input.dailyOrderId,
      },
    });
    return;
  }

  await tx.driverWalletTransaction.create({
    data: {
      driverId: input.driverId,
      contractId: input.contractId,
      type: "CHARGE",
      amount: normalizedAmount,
      date: input.date,
      descriptionAr: input.descriptionAr,
      dailyOrderId: input.dailyOrderId,
    },
  });
}
