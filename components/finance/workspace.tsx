import type { ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Inbox } from "lucide-react";

export const financePrimary = buttonVariants({ className: "rounded-lg" });
export const financeOutline = buttonVariants({ variant: "outline", className: "rounded-lg" });
export const financeSmall = buttonVariants({ variant: "outline", size: "sm", className: "rounded-lg" });

export function FinanceMetric({ label, value, icon, tone = "default", hint }: {
  label: string; value: ReactNode; icon?: ReactNode; tone?: "default" | "positive" | "negative" | "blue"; hint?: string;
}) {
  const color = { default: "text-foreground", positive: "text-emerald-600", negative: "text-red-600", blue: "text-blue-600" }[tone];
  return <div className="stat-card rounded-xl p-5"><div className="flex items-center justify-between gap-3"><span className="text-sm text-muted-foreground">{label}</span>{icon && <span className={`rounded-lg bg-muted p-2 ${color}`}>{icon}</span>}</div><p className={`number text-2xl font-bold ${color}`}>{value}</p>{hint && <p className="text-xs text-muted-foreground">{hint}</p>}</div>;
}

export function FinanceEmpty({ title, description }: { title: string; description?: string }) {
  return <div className="flex flex-col items-center gap-3 px-6 py-12 text-center"><span className="rounded-full bg-muted p-4 text-muted-foreground"><Inbox size={24} /></span><p className="font-medium">{title}</p>{description && <p className="max-w-md text-sm text-muted-foreground">{description}</p>}</div>;
}

