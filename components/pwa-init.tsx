"use client";

import { useEffect } from "react";
import { initSyncListeners } from "@/lib/offline/sync";

interface PWAInitProps {
  companyId?: string;
}

export function PWAInit({ companyId }: PWAInitProps) {
  useEffect(() => {
    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").then((registration) => {
        console.log("SW registered:", registration.scope);
      }).catch((err) => {
        console.error("SW registration failed:", err);
      });
    }

    // Listen for SW messages
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data?.type === "SYNC_REQUESTED" && companyId) {
          import("@/lib/offline/sync").then(({ syncOfflineData }) => {
            syncOfflineData(companyId);
          });
        }
      });
    }

    // Initialize sync listeners if company is set
    let cleanup: (() => void) | undefined;
    if (companyId) {
      import("@/lib/offline/sync").then(({ initSyncListeners }) => {
        cleanup = initSyncListeners(companyId);
      });
    }

    return () => cleanup?.();
  }, [companyId]);

  return null;
}
