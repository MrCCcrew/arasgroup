import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

const PLATE_NUMBER_EXISTS_MESSAGE = "رقم اللوحة مسجل مسبقاً داخل هذه الشركة";
const FUEL_CARD_EXISTS_MESSAGE = "رقم بطاقة الوقود مسجل مسبقاً داخل هذه الشركة";

type VehicleValidationClient = Prisma.TransactionClient | typeof prisma;

export function normalizeVehicleString(value: string | null | undefined): string | null | undefined {
  if (value === undefined || value === null) return value;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function findVehicleIdentityConflict({
  companyId,
  plateNumber,
  fuelCardNumber,
  excludeVehicleId,
  db = prisma,
}: {
  companyId: string;
  plateNumber?: string | null;
  fuelCardNumber?: string | null;
  excludeVehicleId?: string;
  db?: VehicleValidationClient;
}): Promise<string | null> {
  if (plateNumber) {
    const plateConflict = await db.vehicle.findFirst({
      where: {
        companyId,
        plateNumber,
        ...(excludeVehicleId ? { id: { not: excludeVehicleId } } : {}),
      },
      select: { id: true },
    });

    if (plateConflict) return PLATE_NUMBER_EXISTS_MESSAGE;
  }

  if (fuelCardNumber) {
    const fuelCardConflict = await db.vehicle.findFirst({
      where: {
        companyId,
        fuelCardNumber,
        ...(excludeVehicleId ? { id: { not: excludeVehicleId } } : {}),
      },
      select: { id: true },
    });

    if (fuelCardConflict) return FUEL_CARD_EXISTS_MESSAGE;
  }

  return null;
}

export function getVehicleUniqueConstraintMessage(error: unknown): string | null {
  if (
    typeof error !== "object" ||
    error === null ||
    !("code" in error) ||
    (error as { code?: string }).code !== "P2002"
  ) {
    return null;
  }

  const metaTarget = "meta" in error ? (error as { meta?: { target?: unknown } }).meta?.target : undefined;
  const target = Array.isArray(metaTarget) ? metaTarget.join(",") : String(metaTarget ?? "");

  if (target.includes("plateNumber")) return PLATE_NUMBER_EXISTS_MESSAGE;
  if (target.includes("fuelCardNumber")) return FUEL_CARD_EXISTS_MESSAGE;

  return "يوجد سجل مكرر يمنع حفظ المركبة";
}
