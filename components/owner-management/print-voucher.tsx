"use client";
import { financePrimary } from "@/components/finance/workspace";
export function PrintVoucher() {
  return <button onClick={() => window.print()} className={financePrimary}>طباعة السند</button>;
}
