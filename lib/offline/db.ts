import Dexie, { type Table } from "dexie";

// ─── Local entity types (mirrors Prisma but simplified) ──────

export interface LocalDeliveryDailyOrder {
  id: string;
  clientId: string;
  driverId: string;
  contractId: string;
  companyId: string;
  date: string;
  ordersCount: number;
  rating?: number;
  notes?: string;
  synced: boolean;
  createdAt: string;
}

export interface LocalCarWashOperation {
  id: string;
  clientId: string;
  vehicleId: string;
  locationId: string;
  companyId: string;
  date: string;
  totalCash: number;
  totalKnet: number;
  totalExpenses: number;
  netRevenue: number;
  notes?: string;
  synced: boolean;
  createdAt: string;
}

export interface LocalExpense {
  id: string;
  clientId: string;
  companyId: string;
  categoryId: string;
  date: string;
  amount: number;
  descriptionAr: string;
  paymentMethod: string;
  branchId?: string;
  driverId?: string;
  synced: boolean;
  createdAt: string;
}

export interface LocalWalletDeposit {
  id: string;
  clientId: string;
  driverId: string;
  companyId: string;
  amount: number;
  date: string;
  isBankDeposit: boolean;
  descriptionAr?: string;
  synced: boolean;
  createdAt: string;
}

export interface LocalSyncQueueItem {
  id?: number;
  clientId: string;
  operation: "CREATE" | "UPDATE" | "DELETE";
  module: string;
  entityType: string;
  entityId?: string;
  payload: Record<string, unknown>;
  status: "PENDING" | "SYNCING" | "SYNCED" | "FAILED";
  retryCount: number;
  error?: string;
  companyId: string;
  userId: string;
  deviceId: string;
  clientTimestamp: string;
}

// ─── Dexie Database ──────────────────────────────────────────

export class RashidGroupDB extends Dexie {
  dailyOrders!: Table<LocalDeliveryDailyOrder>;
  carWashOperations!: Table<LocalCarWashOperation>;
  expenses!: Table<LocalExpense>;
  walletDeposits!: Table<LocalWalletDeposit>;
  syncQueue!: Table<LocalSyncQueueItem>;

  constructor() {
    super("RashidGroupERP");

    this.version(1).stores({
      dailyOrders: "id, clientId, companyId, driverId, contractId, date, synced",
      carWashOperations: "id, clientId, companyId, vehicleId, date, synced",
      expenses: "id, clientId, companyId, categoryId, date, synced",
      walletDeposits: "id, clientId, companyId, driverId, date, synced",
      syncQueue: "++id, clientId, companyId, status, module, entityType, clientTimestamp",
    });
  }
}

export const offlineDb = typeof window !== "undefined" ? new RashidGroupDB() : null;

/** Add item to sync queue */
export async function addToSyncQueue(
  item: Omit<LocalSyncQueueItem, "id" | "status" | "retryCount">
): Promise<void> {
  if (!offlineDb) return;

  await offlineDb.syncQueue.add({
    ...item,
    status: "PENDING",
    retryCount: 0,
  });
}

/** Get pending sync items */
export async function getPendingSyncItems(): Promise<LocalSyncQueueItem[]> {
  if (!offlineDb) return [];
  return offlineDb.syncQueue.where("status").equals("PENDING").toArray();
}

/** Get pending count */
export async function getPendingSyncCount(): Promise<number> {
  if (!offlineDb) return 0;
  return offlineDb.syncQueue.where("status").equals("PENDING").count();
}

/** Mark sync item as synced */
export async function markSynced(clientId: string): Promise<void> {
  if (!offlineDb) return;
  await offlineDb.syncQueue
    .where("clientId")
    .equals(clientId)
    .modify({ status: "SYNCED" });
}

/** Mark sync item as failed */
export async function markFailed(clientId: string, error: string): Promise<void> {
  if (!offlineDb) return;
  await offlineDb.syncQueue
    .where("clientId")
    .equals(clientId)
    .modify((item) => {
      item.status = "FAILED";
      item.error = error;
      item.retryCount++;
    });
}
