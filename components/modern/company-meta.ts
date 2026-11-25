/** Display-only helpers for the modern interface (labels and avatar colors per company type). */

export const COMPANY_TYPE_LABELS_AR: Record<string, string> = {
  DELIVERY: "شركة توصيل",
  CAR_WASH: "غسيل سيارات",
  GENERAL_TRADING: "تجارة عامة",
  TRADING: "تجارة عامة",
  CONTRACTING: "مقاولات",
  HOLDING: "قابضة",
  OWNER_MANAGED: "يديرها المالك",
  GROCERY: "بقالة",
  CLOTHING_RETAIL: "ملابس جاهزة",
  TAILORING: "خياطة",
  FABRIC_RETAIL: "بيع أقمشة",
  TAILORING_FABRIC_RETAIL: "خياطة وبيع أقمشة",
  TOBACCO_SHISHA: "سجائر وشيشة",
  MOBILE_REPAIR_ACCESSORIES: "إكسسوارات وتصليح موبايل",
  OTHER: "أخرى",
};

const RETAIL = ["GROCERY", "CLOTHING_RETAIL", "TAILORING", "FABRIC_RETAIL", "TAILORING_FABRIC_RETAIL", "TOBACCO_SHISHA", "MOBILE_REPAIR_ACCESSORIES"];

/** Tailwind classes for the soft avatar (background + text) of a company type. */
export function companyAvatarClasses(type: string): string {
  if (type === "DELIVERY") return "bg-[#EEF2FF] text-[#3B5BDB]";
  if (type === "CAR_WASH") return "bg-[#E0F7FA] text-[#0B6B7A]";
  if (type === "GENERAL_TRADING" || type === "TRADING") return "bg-[#ECFDF3] text-[#067647]";
  if (type === "CONTRACTING") return "bg-[#FFF4ED] text-[#B93815]";
  if (type === "OWNER_MANAGED") return "bg-[#F4F3FF] text-[#5925DC]";
  if (RETAIL.includes(type)) return "bg-[#FEF6E7] text-[#8A5A00]";
  return "bg-[#F1F4F9] text-[#334155]";
}

export function companyTypeLabel(type: string): string {
  return COMPANY_TYPE_LABELS_AR[type] ?? type;
}
