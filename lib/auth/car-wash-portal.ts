import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";

export async function getCarWashPortalContext(session: SessionUser) {
  if (session.accountType !== "CAR_WASH_WORKER" || !session.employeeId) return null;
  const employee = await prisma.employee.findUnique({
    where: { id: session.employeeId },
    include: { company: { select: { id: true, type: true, nameAr: true, nameEn: true } }, carWashWorker: { select: { assignedCarWashVehicleId: true } } },
  });
  if (!employee || employee.company.type !== "CAR_WASH") return null;
  return { userId: session.id, employeeId: employee.id, companyId: employee.company.id, branchId: employee.branchId, assignedVehicleId: employee.carWashWorker?.assignedCarWashVehicleId ?? null, company: employee.company };
}
