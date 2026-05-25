import { prisma } from "@/lib/db";
import { kuwaitNow } from "@/lib/utils";

type NotificationSeedInput = {
  type: string;
  uniqueKey: string;
  titleAr: string;
  titleEn?: string;
  messageAr?: string;
  messageEn?: string;
  entityType?: string;
  entityId?: string;
  companyId?: string;
  branchId?: string;
  investorId?: string;
  licenseId?: string;
  employeeId?: string;
  vehicleId?: string;
  targetRole?: string;
  targetUserId?: string;
  dueDate?: Date | null;
  severity?: "INFO" | "WARNING" | "DANGER" | "SUCCESS";
  refModule?: string;
  refId?: string;
};

export async function upsertNotification(input: NotificationSeedInput) {
  return prisma.notification.upsert({
    where: { uniqueKey: input.uniqueKey },
    update: {
      titleAr: input.titleAr,
      titleEn: input.titleEn,
      messageAr: input.messageAr,
      messageEn: input.messageEn,
      dueDate: input.dueDate,
      severity: input.severity ?? "WARNING",
      status: "UNREAD",
      resolvedAt: null,
      readAt: null,
      targetRole: input.targetRole,
      targetUserId: input.targetUserId,
      refModule: input.refModule,
      refId: input.refId,
    },
    create: {
      type: input.type,
      uniqueKey: input.uniqueKey,
      titleAr: input.titleAr,
      titleEn: input.titleEn,
      messageAr: input.messageAr,
      messageEn: input.messageEn,
      entityType: input.entityType,
      entityId: input.entityId,
      companyId: input.companyId,
      branchId: input.branchId,
      investorId: input.investorId,
      licenseId: input.licenseId,
      employeeId: input.employeeId,
      vehicleId: input.vehicleId,
      targetRole: input.targetRole,
      targetUserId: input.targetUserId,
      dueDate: input.dueDate,
      severity: input.severity ?? "WARNING",
      refModule: input.refModule,
      refId: input.refId,
    },
  });
}

export async function resolveNotification(uniqueKey: string) {
  return prisma.notification.updateMany({
    where: { uniqueKey, status: { not: "RESOLVED" } },
    data: {
      status: "RESOLVED",
      resolvedAt: kuwaitNow(),
    },
  });
}

export async function markNotificationRead(id: string) {
  return prisma.notification.update({
    where: { id },
    data: {
      status: "READ",
      readAt: kuwaitNow(),
    },
  });
}

export async function markAllNotificationsRead(targetUserId?: string) {
  return prisma.notification.updateMany({
    where: {
      status: "UNREAD",
      ...(targetUserId ? { targetUserId } : {}),
    },
    data: {
      status: "READ",
      readAt: kuwaitNow(),
    },
  });
}

export async function regenerateNotifications() {
  const now = kuwaitNow();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const in6Months = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);

  const [employees, licenses, vehicles, investorClaims, investorSalaryCollections] = await Promise.all([
    prisma.employee.findMany({
      where: {
        isDeleted: false,
        isActive: true,
        OR: [
          { residencyExpiry: { gte: now, lte: in30Days } },
          { passportExpiryDate: { gte: now, lte: in6Months } },
          { healthCardExpiryDate: { gte: now, lte: in30Days } },
          { licenseExpiry: { gte: now, lte: in30Days } },
          { visaExpiryDate: { gte: now, lte: in30Days } },
        ],
      },
      select: {
        id: true,
        nameAr: true,
        nameEn: true,
        companyId: true,
        branchId: true,
        residencyExpiry: true,
        passportExpiryDate: true,
        healthCardExpiryDate: true,
        licenseExpiry: true,
        visaExpiryDate: true,
      },
    }),
    prisma.license.findMany({
      where: {
        status: { not: "CANCELLED" },
        OR: [
          { licenseExpiryDate: { gte: now, lte: in30Days } },
          { fireLicenseExpiryDate: { gte: now, lte: in30Days } },
          { healthLicenseExpiryDate: { gte: now, lte: in30Days } },
          { advertisingLicenseExpiryDate: { gte: now, lte: in30Days } },
        ],
      },
      select: {
        id: true,
        commercialNameAr: true,
        commercialNameEn: true,
        companyId: true,
        branchId: true,
        licenseExpiryDate: true,
        fireLicenseExpiryDate: true,
        healthLicenseExpiryDate: true,
        advertisingLicenseExpiryDate: true,
      },
    }),
    prisma.vehicle.findMany({
      where: {
        isActive: true,
        OR: [
          { insuranceExpiryDate: { gte: now, lte: in30Days } },
          { advertisingCardExpiryDate: { gte: now, lte: in30Days } },
          { foodLicenseExpiryDate: { gte: now, lte: in30Days } },
        ],
      },
      select: {
        id: true,
        companyId: true,
        branchId: true,
        plateNumber: true,
        insuranceExpiryDate: true,
        advertisingCardExpiryDate: true,
        foodLicenseExpiryDate: true,
      },
    }),
    prisma.investorClaim.findMany({
      where: {
        dueDate: { not: null },
        status: { in: ["PENDING", "PARTIALLY_COLLECTED", "COLLECTED"] },
      },
      include: { investor: { select: { nameAr: true, nameEn: true } } },
    }),
    prisma.investorSalaryCollection.findMany({
      where: { status: { not: "COLLECTED_CONFIRMED" } },
      include: { investor: { select: { nameAr: true, nameEn: true } } },
    }),
  ]);

  await Promise.all(employees.flatMap((employee) => {
    const jobs: Promise<unknown>[] = [];
    if (employee.residencyExpiry) {
      jobs.push(upsertNotification({
        type: "RESIDENCY_EXPIRY",
        uniqueKey: `employee:${employee.id}:residency:${employee.residencyExpiry.toISOString().slice(0, 10)}`,
        titleAr: "تنبيه انتهاء الإقامة",
        titleEn: "Residency expiry alert",
        messageAr: `إقامة الموظف ${employee.nameAr} تنتهي قريباً`,
        messageEn: `Employee residency for ${employee.nameEn ?? employee.nameAr} is expiring soon`,
        companyId: employee.companyId,
        branchId: employee.branchId ?? undefined,
        employeeId: employee.id,
        entityType: "EMPLOYEE",
        entityId: employee.id,
        dueDate: employee.residencyExpiry,
        severity: "WARNING",
        targetRole: "ADMINISTRATIVE_AFFAIRS",
        refModule: "hr",
        refId: employee.id,
      }));
    }
    if (employee.passportExpiryDate) {
      jobs.push(upsertNotification({
        type: "PASSPORT_EXPIRY",
        uniqueKey: `employee:${employee.id}:passport:${employee.passportExpiryDate.toISOString().slice(0, 10)}`,
        titleAr: "تنبيه انتهاء جواز السفر",
        titleEn: "Passport expiry alert",
        messageAr: `جواز الموظف ${employee.nameAr} ينتهي قريباً`,
        messageEn: `Passport for ${employee.nameEn ?? employee.nameAr} is expiring soon`,
        companyId: employee.companyId,
        branchId: employee.branchId ?? undefined,
        employeeId: employee.id,
        entityType: "EMPLOYEE",
        entityId: employee.id,
        dueDate: employee.passportExpiryDate,
        severity: "WARNING",
        targetRole: "ADMINISTRATIVE_AFFAIRS",
        refModule: "hr",
        refId: employee.id,
      }));
    }
    return jobs;
  }));

  await Promise.all(licenses.flatMap((license) => {
    const jobs: Promise<unknown>[] = [];
    const name = license.commercialNameAr;
    if (license.licenseExpiryDate) {
      jobs.push(upsertNotification({
        type: "COMMERCIAL_LICENSE_EXPIRY",
        uniqueKey: `license:${license.id}:commercial:${license.licenseExpiryDate.toISOString().slice(0, 10)}`,
        titleAr: "تنبيه انتهاء الترخيص التجاري",
        titleEn: "Commercial license expiry alert",
        messageAr: `الترخيص التجاري لـ ${name} ينتهي قريباً`,
        messageEn: `Commercial license for ${license.commercialNameEn ?? name} is expiring soon`,
        companyId: license.companyId,
        branchId: license.branchId ?? undefined,
        licenseId: license.id,
        entityType: "LICENSE",
        entityId: license.id,
        dueDate: license.licenseExpiryDate,
        severity: "WARNING",
        targetRole: "ADMINISTRATIVE_AFFAIRS",
        refModule: "licenses",
        refId: license.id,
      }));
    }
    return jobs;
  }));

  await Promise.all(vehicles.flatMap((vehicle) => {
    const jobs: Promise<unknown>[] = [];
    if (vehicle.insuranceExpiryDate) {
      jobs.push(upsertNotification({
        type: "VEHICLE_INSURANCE_EXPIRY",
        uniqueKey: `vehicle:${vehicle.id}:insurance:${vehicle.insuranceExpiryDate.toISOString().slice(0, 10)}`,
        titleAr: "تنبيه انتهاء تأمين المركبة",
        titleEn: "Vehicle insurance expiry alert",
        messageAr: `تأمين المركبة ${vehicle.plateNumber} ينتهي قريباً`,
        messageEn: `Insurance for vehicle ${vehicle.plateNumber} is expiring soon`,
        companyId: vehicle.companyId,
        branchId: vehicle.branchId ?? undefined,
        vehicleId: vehicle.id,
        entityType: "VEHICLE",
        entityId: vehicle.id,
        dueDate: vehicle.insuranceExpiryDate,
        severity: "WARNING",
        targetRole: "VEHICLES",
        refModule: "vehicles",
        refId: vehicle.id,
      }));
    }
    return jobs;
  }));

  await Promise.all(investorClaims.map((claim) => upsertNotification({
    type: "INVESTOR_CLAIM_DUE",
    uniqueKey: `claim:${claim.id}:due:${claim.dueDate?.toISOString().slice(0, 10) ?? "na"}`,
    titleAr: "مطالبة مسئول مستحقة",
    titleEn: "Investor claim due",
    messageAr: `مطالبة المسئول ${claim.investor.nameAr} مستحقة`,
    messageEn: `Investor claim for ${claim.investor.nameEn ?? claim.investor.nameAr} is due`,
    companyId: claim.companyId,
    branchId: claim.branchId ?? undefined,
    investorId: claim.investorId,
    entityType: "INVESTOR_CLAIM",
    entityId: claim.id,
    dueDate: claim.dueDate,
    severity: claim.dueDate && claim.dueDate < now ? "DANGER" : "WARNING",
    targetRole: "ACCOUNTANT",
    refModule: "investor_claims",
    refId: claim.id,
  })));

  await Promise.all(investorSalaryCollections.map((collection) => {
    const dueDate = new Date(collection.year, collection.month - 1, 22);
    if (dueDate > now) return Promise.resolve(null);
    return upsertNotification({
      type: "INVESTOR_SALARY_COLLECTION_DUE",
      uniqueKey: `salary-collection:${collection.id}:${collection.month}-${collection.year}`,
      titleAr: "تحصيل رواتب المسئولين والمديرين مستحق",
      titleEn: "Investor salary collection due",
      messageAr: `تحصيل رواتب المسئول ${collection.investor.nameAr} مستحق`,
      messageEn: `Salary collection for investor ${collection.investor.nameEn ?? collection.investor.nameAr} is due`,
      companyId: collection.companyId,
      branchId: collection.branchId ?? undefined,
      investorId: collection.investorId,
      entityType: "INVESTOR_SALARY_COLLECTION",
      entityId: collection.id,
      dueDate,
      severity: "WARNING",
      targetRole: "ACCOUNTANT",
      refModule: "investor_salaries",
      refId: collection.id,
    });
  }));

  return {
    employees: employees.length,
    licenses: licenses.length,
    vehicles: vehicles.length,
    investorClaims: investorClaims.length,
    investorSalaryCollections: investorSalaryCollections.length,
  };
}
