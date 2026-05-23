"use client";

import {
  getPendingSyncItems,
  markSynced,
  markFailed,
  type LocalSyncQueueItem,
} from "./db";

const MAX_RETRIES = 3;
let isSyncing = false;

/** Main sync function — uploads all pending offline items to server */
export async function syncOfflineData(companyId: string): Promise<{
  synced: number;
  failed: number;
}> {
  if (isSyncing) return { synced: 0, failed: 0 };

  // Check online status
  if (!navigator.onLine) return { synced: 0, failed: 0 };

  isSyncing = true;
  let synced = 0;
  let failed = 0;

  try {
    const pending = await getPendingSyncItems();
    const companyItems = pending.filter(
      (item) => item.companyId === companyId && item.retryCount < MAX_RETRIES
    );

    if (companyItems.length === 0) return { synced: 0, failed: 0 };

    // Send to server in batches
    const batchSize = 10;
    for (let i = 0; i < companyItems.length; i += batchSize) {
      const batch = companyItems.slice(i, i + batchSize);

      try {
        const response = await fetch("/api/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyId,
            items: batch.map((item) => ({
              clientId: item.clientId,
              deviceId: item.deviceId,
              operation: item.operation,
              module: item.module,
              entityType: item.entityType,
              entityId: item.entityId,
              payload: item.payload,
              clientTimestamp: item.clientTimestamp,
            })),
          }),
        });

        if (!response.ok) {
          for (const item of batch) {
            await markFailed(item.clientId, `HTTP ${response.status}`);
            failed++;
          }
          continue;
        }

        const result = await response.json();

        for (const itemResult of result.data ?? []) {
          if (itemResult.status === "SYNCED") {
            await markSynced(itemResult.clientId);
            synced++;
          } else {
            await markFailed(itemResult.clientId, itemResult.error ?? "Unknown error");
            failed++;
          }
        }
      } catch (err) {
        for (const item of batch) {
          await markFailed(item.clientId, err instanceof Error ? err.message : "Network error");
          failed++;
        }
      }
    }
  } finally {
    isSyncing = false;
  }

  return { synced, failed };
}

/** Initialize sync listeners */
export function initSyncListeners(companyId: string): () => void {
  const handleOnline = () => {
    console.log("Back online, syncing...");
    syncOfflineData(companyId).then(({ synced, failed }) => {
      if (synced > 0) {
        console.log(`Synced ${synced} items, ${failed} failed`);
      }
    });
  };

  window.addEventListener("online", handleOnline);

  // Periodic sync every 2 minutes if online
  const interval = setInterval(() => {
    if (navigator.onLine) syncOfflineData(companyId);
  }, 120_000);

  return () => {
    window.removeEventListener("online", handleOnline);
    clearInterval(interval);
  };
}

/** Get device ID (persistent per browser) */
export function getDeviceId(): string {
  const key = "rashid_erp_device_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = `device-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    localStorage.setItem(key, id);
  }
  return id;
}
