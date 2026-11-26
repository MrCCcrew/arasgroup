import { z } from "zod";

export const voucherPrintSettingsSchema = z.object({
  copies: z.union([z.literal(1), z.literal(2)]),
  orientation: z.enum(["portrait", "landscape"]),
}).strict();
export type VoucherPrintSettings = z.infer<typeof voucherPrintSettingsSchema>;
export const defaultVoucherPrintSettings: VoucherPrintSettings = { copies: 2, orientation: "portrait" };

export function effectiveVoucherPrintSettings(type: string, settings: VoucherPrintSettings): VoucherPrintSettings {
  return type === "RECEIPT" || type === "PAYMENT" ? settings : defaultVoucherPrintSettings;
}
