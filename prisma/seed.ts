import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

const permissionSeeds = [
  ["DASHBOARD", "VIEW", "GROUP"],
  ["COMPANIES", "VIEW", "GROUP"],
  ["COMPANIES", "CREATE", "GROUP"],
  ["COMPANIES", "UPDATE", "GROUP"],
  ["BRANCHES", "VIEW", "COMPANY"],
  ["BRANCHES", "CREATE", "COMPANY"],
  ["BRANCHES", "UPDATE", "COMPANY"],
  ["ACCOUNTING", "VIEW", "COMPANY"],
  ["ACCOUNTING", "CREATE", "COMPANY"],
  ["ACCOUNTING", "UPDATE", "COMPANY"],
  ["ACCOUNTING", "APPROVE", "COMPANY"],
  ["ACCOUNTING", "EXPORT", "COMPANY"],
  ["ACCOUNTING", "PRINT", "COMPANY"],
  ["BANKS", "VIEW", "COMPANY"],
  ["HR", "VIEW", "COMPANY"],
  ["HR", "CREATE", "COMPANY"],
  ["HR", "UPDATE", "COMPANY"],
  ["HR", "EXPORT", "COMPANY"],
  ["DELIVERY_HR", "VIEW", "COMPANY"],
  ["DELIVERY_HR", "CREATE", "COMPANY"],
  ["DELIVERY_HR", "UPDATE", "COMPANY"],
  ["DELIVERY_HR", "ASSIGN", "COMPANY"],
  ["DELIVERY_HR", "RETURN", "COMPANY"],
  ["DELIVERY_HR", "EXPORT", "COMPANY"],
  ["DELIVERY_OPERATIONS", "VIEW", "COMPANY"],
  ["DELIVERY_OPERATIONS", "CREATE", "COMPANY"],
  ["DELIVERY_OPERATIONS", "UPDATE", "COMPANY"],
  ["DELIVERY_REPORTS", "VIEW", "COMPANY"],
  ["DELIVERY_REPORTS", "EXPORT", "COMPANY"],
  ["DELIVERY_REPORTS", "PRINT", "COMPANY"],
  ["CAR_WASH_HR", "VIEW", "COMPANY"],
  ["CAR_WASH_HR", "CREATE", "COMPANY"],
  ["CAR_WASH_HR", "UPDATE", "COMPANY"],
  ["CAR_WASH_HR", "ASSIGN", "COMPANY"],
  ["CAR_WASH_HR", "RETURN", "COMPANY"],
  ["CAR_WASH_HR", "EXPORT", "COMPANY"],
  ["CAR_WASH_OPERATIONS", "VIEW", "COMPANY"],
  ["CAR_WASH_OPERATIONS", "CREATE", "COMPANY"],
  ["CAR_WASH_OPERATIONS", "UPDATE", "COMPANY"],
  ["CAR_WASH_REPORTS", "VIEW", "COMPANY"],
  ["CAR_WASH_REPORTS", "EXPORT", "COMPANY"],
  ["CAR_WASH_REPORTS", "PRINT", "COMPANY"],
  ["VEHICLES", "VIEW", "COMPANY"],
  ["VEHICLES", "CREATE", "COMPANY"],
  ["VEHICLES", "UPDATE", "COMPANY"],
  ["VEHICLES", "ASSIGN", "COMPANY"],
  ["ASSETS_CUSTODY", "VIEW", "COMPANY"],
  ["ASSETS_CUSTODY", "CREATE", "COMPANY"],
  ["ASSETS_CUSTODY", "UPDATE", "COMPANY"],
  ["ASSETS_CUSTODY", "ASSIGN", "COMPANY"],
  ["ASSETS_CUSTODY", "RETURN", "COMPANY"],
  ["ASSETS_CUSTODY", "PRINT", "COMPANY"],
  ["ATTACHMENTS", "VIEW", "COMPANY"],
  ["ATTACHMENTS", "UPLOAD", "COMPANY"],
  ["ATTACHMENTS", "DOWNLOAD", "COMPANY"],
  ["ATTACHMENTS", "DELETE", "COMPANY"],
  ["INVESTORS", "VIEW", "COMPANY"],
  ["INVESTORS", "CREATE", "COMPANY"],
  ["INVESTORS", "UPDATE", "COMPANY"],
  ["EXPENSES", "VIEW", "COMPANY"],
  ["EXPENSES", "CREATE", "COMPANY"],
  ["EXPENSES", "UPDATE", "COMPANY"],
  ["EXPENSES", "EXPORT", "COMPANY"],
  ["REPORTS", "VIEW", "COMPANY"],
  ["REPORTS", "EXPORT", "COMPANY"],
  ["REPORTS", "PRINT", "COMPANY"],
  ["SETTINGS", "VIEW", "GROUP"],
  ["USERS", "VIEW", "GROUP"],
  ["USERS", "CREATE", "GROUP"],
  ["USERS", "UPDATE", "GROUP"],
  ["AUDIT_LOGS", "VIEW", "GROUP"],
] as const;

const rolePermissionMap: Record<string, ReadonlyArray<readonly [string, string, string]>> = {
  SUPER_ADMIN: permissionSeeds,
  GROUP_OWNER: permissionSeeds.filter(([module]) => !["USERS", "AUDIT_LOGS"].includes(module)),
  ACCOUNTANT: permissionSeeds.filter(([module]) =>
    ["DASHBOARD", "ACCOUNTING", "BANKS", "EXPENSES", "REPORTS", "DELIVERY_REPORTS", "CAR_WASH_REPORTS", "ATTACHMENTS"].includes(module)
  ),
  DELIVERY_HR: permissionSeeds.filter(([module]) =>
    ["DASHBOARD", "HR", "DELIVERY_HR", "VEHICLES", "ASSETS_CUSTODY", "ATTACHMENTS", "REPORTS"].includes(module)
  ),
  DELIVERY_OPERATIONS: permissionSeeds.filter(([module]) =>
    ["DASHBOARD", "DELIVERY_OPERATIONS", "DELIVERY_REPORTS", "VEHICLES", "ATTACHMENTS"].includes(module)
  ),
  CAR_WASH_SUPERVISOR: permissionSeeds.filter(([module]) =>
    ["DASHBOARD", "CAR_WASH_HR", "CAR_WASH_OPERATIONS", "CAR_WASH_REPORTS", "VEHICLES", "ASSETS_CUSTODY", "ATTACHMENTS", "EXPENSES"].includes(module)
  ),
  HR_MANDOB: permissionSeeds.filter(([module]) =>
    ["DASHBOARD", "HR", "INVESTORS", "ATTACHMENTS"].includes(module)
  ),
  INVESTOR_VIEWER: permissionSeeds.filter(([module]) =>
    ["DASHBOARD", "INVESTORS", "REPORTS"].includes(module)
  ),
  READ_ONLY: permissionSeeds.filter(([module]) =>
    ["DASHBOARD", "REPORTS", "ATTACHMENTS"].includes(module)
  ),
};

const companySeeds = [
  {
    id: "co-it-delivery",
    nameAr: "شركة Atdelivery",
    nameEn: "Atdelivery",
    type: "DELIVERY" as const,
    sortOrder: 1,
  },
  {
    id: "co-eagle-delivery",
    nameAr: "شركة Eagle Delivery",
    nameEn: "Eagle Delivery",
    type: "DELIVERY" as const,
    sortOrder: 2,
  },
  {
    id: "co-bergen-carwash",
    nameAr: "Bergen لغسيل السيارات",
    nameEn: "Bergen Car Wash",
    type: "CAR_WASH" as const,
    sortOrder: 3,
  },
  {
    id: "co-silver-valley",
    nameAr: "Silver Valley للتجارة العامة",
    nameEn: "Silver Valley General Trading",
    type: "GENERAL_TRADING" as const,
    sortOrder: 4,
  },
  {
    id: "co-bergen-trading",
    nameAr: "Bergen للتجارة العامة",
    nameEn: "Bergen General Trading",
    type: "GENERAL_TRADING" as const,
    sortOrder: 5,
  },
];

const deliveryAssetTypes: { nameAr: string; nameEn: string; requiresSerial: boolean }[] = [
  { nameAr: "هاتف محمول",    nameEn: "Mobile phone",       requiresSerial: true  },
  { nameAr: "شريحة اتصال",  nameEn: "SIM card",           requiresSerial: true  },
  { nameAr: "بطاقة وقود",   nameEn: "Fuel card",          requiresSerial: true  },
  { nameAr: "حقيبة توصيل",  nameEn: "Delivery bag",       requiresSerial: false },
  { nameAr: "زي موحد",      nameEn: "Uniform",            requiresSerial: false },
  { nameAr: "خوذة",         nameEn: "Helmet",             requiresSerial: false },
  { nameAr: "مفتاح سيارة",  nameEn: "Car key",            requiresSerial: false },
  { nameAr: "وثائق المركبة", nameEn: "Vehicle documents",  requiresSerial: false },
];

const carWashAssetTypes: { nameAr: string; nameEn: string; requiresSerial: boolean }[] = [
  { nameAr: "هاتف محمول",         nameEn: "Mobile phone",       requiresSerial: true  },
  { nameAr: "شريحة اتصال",        nameEn: "SIM card",           requiresSerial: true  },
  { nameAr: "غسالة",              nameEn: "Washing machine",    requiresSerial: false },
  { nameAr: "مكنسة كهربائية",     nameEn: "Vacuum",             requiresSerial: false },
  { nameAr: "معدات خزان المياه",   nameEn: "Water tank equipment",requiresSerial: false},
  { nameAr: "خرطوم مياه",         nameEn: "Hose",               requiresSerial: false },
  { nameAr: "أدوات النظافة",      nameEn: "Cleaning tools",     requiresSerial: false },
  { nameAr: "رشاش الكيماويات",    nameEn: "Chemical sprayer",   requiresSerial: false },
  { nameAr: "مولد كهربائي",       nameEn: "Generator",          requiresSerial: true  },
  { nameAr: "جهاز نقطة البيع",    nameEn: "POS/KNET device",    requiresSerial: true  },
  { nameAr: "زي موحد",            nameEn: "Uniform",            requiresSerial: false },
];

async function main() {
  console.log("Seeding Rashid Group ERP...");

  const group = await prisma.group.upsert({
    where: { id: "group-rashid" },
    update: {
      nameAr: "مجموعة عبد الفتاح راشد سليمان",
      nameEn: "Abdul Fattah Rashid Suleiman Group",
      address: "الكويت",
      phone: "+965-XXXXXXXX",
    },
    create: {
      id: "group-rashid",
      nameAr: "مجموعة عبد الفتاح راشد سليمان",
      nameEn: "Abdul Fattah Rashid Suleiman Group",
      address: "الكويت",
      phone: "+965-XXXXXXXX",
    },
  });

  const companies = [];
  for (const seed of companySeeds) {
    const company = await prisma.company.upsert({
      where: { id: seed.id },
      update: {
        groupId: group.id,
        nameAr: seed.nameAr,
        nameEn: seed.nameEn,
        type: seed.type,
        sortOrder: seed.sortOrder,
      },
      create: {
        id: seed.id,
        groupId: group.id,
        nameAr: seed.nameAr,
        nameEn: seed.nameEn,
        type: seed.type,
        sortOrder: seed.sortOrder,
      },
    });
    companies.push(company);
  }

  const [itDelivery, eagleDelivery, bergenCarWash, silverValley, bergenTrading] = companies;

  for (const company of companies) {
    await prisma.fiscalYear.upsert({
      where: { companyId_year: { companyId: company.id, year: 2025 } },
      update: {
        startDate: new Date("2025-01-01"),
        endDate: new Date("2025-12-31"),
        isCurrent: true,
      },
      create: {
        companyId: company.id,
        year: 2025,
        startDate: new Date("2025-01-01"),
        endDate: new Date("2025-12-31"),
        isCurrent: true,
      },
    });
  }

  await prisma.bankAccount.upsert({
    where: { id: "bank-it-main" },
    update: {
      companyId: itDelivery.id,
      nameAr: "الحساب الرئيسي - Atdelivery",
      bankName: "بنك الكويت الوطني",
      accountNumber: "123456789",
      isDefault: true,
    },
    create: {
      id: "bank-it-main",
      companyId: itDelivery.id,
      nameAr: "الحساب الرئيسي - Atdelivery",
      bankName: "بنك الكويت الوطني",
      accountNumber: "123456789",
      isDefault: true,
    },
  });

  await prisma.bankAccount.upsert({
    where: { id: "bank-bergen-main" },
    update: {
      companyId: bergenTrading.id,
      nameAr: "الحساب الرئيسي - Bergen General Trading",
      bankName: "بنك الخليج",
      accountNumber: "987654321",
      isDefault: true,
    },
    create: {
      id: "bank-bergen-main",
      companyId: bergenTrading.id,
      nameAr: "الحساب الرئيسي - Bergen General Trading",
      bankName: "بنك الخليج",
      accountNumber: "987654321",
      isDefault: true,
    },
  });

  for (const company of companies) {
    await seedChartOfAccounts(company.id);
  }

  for (const [index, code] of ["CW-01", "CW-02", "CW-03", "CW-04"].entries()) {
    await prisma.costCenter.upsert({
      where: { companyId_code: { companyId: bergenCarWash.id, code } },
      update: {},
      create: {
        companyId: bergenCarWash.id,
        code,
        nameAr: `سيارة غسيل ${index + 1}`,
        type: "VEHICLE",
        isActive: true,
      },
    });
  }

  const contracts = [
    {
      id: "contract-talabat-it",
      companyId: itDelivery.id,
      platform: "TALABAT" as const,
      nameAr: "عقد طلبات - Atdelivery",
      startDate: new Date("2024-01-01"),
      isActive: true,
    },
    {
      id: "contract-ropops-it",
      companyId: itDelivery.id,
      platform: "RO_POPS" as const,
      nameAr: "عقد Ro Pops - Atdelivery",
      startDate: new Date("2024-01-01"),
      isActive: true,
    },
    {
      id: "contract-talabat-eagle",
      companyId: eagleDelivery.id,
      platform: "TALABAT" as const,
      nameAr: "عقد طلبات - Eagle Delivery",
      startDate: new Date("2024-01-01"),
      isActive: true,
    },
  ];

  for (const contract of contracts) {
    await prisma.deliveryContract.upsert({
      where: { id: contract.id },
      update: contract,
      create: contract,
    });
  }

  const locations = [
    { id: "loc-360", companyId: bergenCarWash.id, nameAr: "مجمع 360", locationType: "MALL" as const },
    { id: "loc-avenues", companyId: bergenCarWash.id, nameAr: "الأفنيوز", locationType: "MALL" as const },
    { id: "loc-marina", companyId: bergenCarWash.id, nameAr: "مارينا مول", locationType: "MALL" as const },
    { id: "loc-other", companyId: bergenCarWash.id, nameAr: "موقع آخر", locationType: "OTHER" as const },
  ];

  for (const location of locations) {
    await prisma.carWashLocation.upsert({
      where: { id: location.id },
      update: location,
      create: location,
    });
  }

  const categoryGroups = [
    { nameAr: "رواتب وحوافز", code: "SAL", type: "HR" },
    { nameAr: "إيجارات", code: "RENT", type: "OPERATIONAL" },
    { nameAr: "إيجار سيارات", code: "CAR_RENT", type: "OPERATIONAL" },
    { nameAr: "وقود", code: "FUEL", type: "VEHICLE" },
    { nameAr: "صيانة مركبات", code: "VEH_MAINT", type: "VEHICLE" },
    { nameAr: "أقساط سيارات", code: "CAR_INST", type: "VEHICLE" },
    { nameAr: "هاتف واتصالات", code: "PHONE", type: "UTILITIES" },
    { nameAr: "تجديد إقامات", code: "RESIDENCY", type: "LEGAL" },
    { nameAr: "تجديد تراخيص", code: "LICENSE", type: "LEGAL" },
    { nameAr: "مخالفات مرورية", code: "VIOLATIONS", type: "VEHICLE" },
    { nameAr: "مصروفات أخرى", code: "OTHER", type: "ADMINISTRATIVE" },
  ];

  for (const company of companies) {
    for (const category of categoryGroups) {
      await prisma.expenseCategory.upsert({
        where: { companyId_nameAr: { companyId: company.id, nameAr: category.nameAr } },
        update: {
          code: category.code,
          type: category.type,
        },
        create: {
          companyId: company.id,
          nameAr: category.nameAr,
          code: category.code,
          type: category.type,
        },
      });
    }
  }

  const roles = [
    { id: "role-super-admin", name: "SUPER_ADMIN", nameAr: "مدير النظام الأعلى" },
    { id: "role-group-owner", name: "GROUP_OWNER", nameAr: "مالك المجموعة" },
    { id: "role-accountant", name: "ACCOUNTANT", nameAr: "محاسب" },
    { id: "role-delivery-hr", name: "DELIVERY_HR", nameAr: "موارد بشرية التوصيل" },
    { id: "role-delivery-operations", name: "DELIVERY_OPERATIONS", nameAr: "عمليات التوصيل" },
    { id: "role-carwash", name: "CAR_WASH_SUPERVISOR", nameAr: "مشرف غسيل السيارات" },
    { id: "role-hr", name: "HR_MANDOB", nameAr: "مسؤول الموارد البشرية / المندوب" },
    { id: "role-investor", name: "INVESTOR_VIEWER", nameAr: "مشاهد المستثمر" },
    { id: "role-read-only", name: "READ_ONLY", nameAr: "قراءة فقط" },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { nameAr: role.nameAr },
      create: role,
    });
  }

  const permissionIdMap = new Map<string, string>();
  for (const [module, action, scope] of permissionSeeds) {
    const permission = await prisma.permission.upsert({
      where: { module_action_scope: { module, action, scope } },
      update: { resource: "GENERAL" },
      create: { module, action, scope, resource: "GENERAL" },
    });
    permissionIdMap.set(`${module}:${action}:${scope}`, permission.id);
  }

  for (const role of roles) {
    const persistedRole = await prisma.role.findUnique({ where: { name: role.name } });
    if (!persistedRole) continue;

    for (const [module, action, scope] of rolePermissionMap[role.name] ?? []) {
      const permissionId = permissionIdMap.get(`${module}:${action}:${scope}`);
      if (!permissionId) continue;

      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: persistedRole.id, permissionId } },
        update: {},
        create: { roleId: persistedRole.id, permissionId },
      });
    }
  }

  for (const company of [itDelivery, eagleDelivery]) {
    for (const type of deliveryAssetTypes) {
      const existing = await prisma.assetItemType.findFirst({
        where: { companyId: company.id, nameAr: type.nameAr },
        select: { id: true },
      });
      if (!existing) {
        await prisma.assetItemType.create({
          data: {
            companyId: company.id,
            companyType: "DELIVERY",
            nameAr: type.nameAr,
            nameEn: type.nameEn,
            requiresSerialNumber: type.requiresSerial,
            requiresCondition: true,
          },
        });
      } else {
        await prisma.assetItemType.update({
          where: { id: existing.id },
          data: { nameEn: type.nameEn },
        });
      }
    }
  }

  for (const type of carWashAssetTypes) {
    const existing = await prisma.assetItemType.findFirst({
      where: { companyId: bergenCarWash.id, nameAr: type.nameAr },
      select: { id: true },
    });
    if (!existing) {
      await prisma.assetItemType.create({
        data: {
          companyId: bergenCarWash.id,
          companyType: "CAR_WASH",
          nameAr: type.nameAr,
          nameEn: type.nameEn,
          requiresSerialNumber: type.requiresSerial,
          requiresCondition: true,
        },
      });
    } else {
      await prisma.assetItemType.update({
        where: { id: existing.id },
        data: { nameEn: type.nameEn },
      });
    }
  }

  const superAdmin = await upsertUser({
    email: "admin@rashidgroup.kw",
    nameAr: "مدير النظام",
    nameEn: "System Admin",
    password: "Admin@2025!",
    isSuperAdmin: true,
  });

  const accountant = await upsertUser({
    email: "accountant@rashidgroup.kw",
    nameAr: "المحاسب",
    nameEn: "Accountant",
    password: "Accountant@2025!",
  });

  const deliveryHr = await upsertUser({
    email: "delivery_hr@rashidgroup.kw",
    nameAr: "مسؤول موارد التوصيل",
    nameEn: "Delivery HR",
    password: "DeliveryHR@2025!",
  });

  const carWashSupervisor = await upsertUser({
    email: "carwash_supervisor@rashidgroup.kw",
    nameAr: "مشرف غسيل السيارات",
    nameEn: "Car Wash Supervisor",
    password: "CarWash@2025!",
  });

  for (const company of companies) {
    await upsertCompanyAccess(superAdmin.id, company.id, { canView: true, canCreate: true, canUpdate: true, canDelete: true, canApprove: true });
    await upsertCompanyAccess(accountant.id, company.id, { canView: true, canCreate: true, canUpdate: true, canDelete: false, canApprove: true });
  }

  await upsertCompanyAccess(deliveryHr.id, itDelivery.id, { canView: true, canCreate: true, canUpdate: true, canDelete: false, canApprove: false });
  await upsertCompanyAccess(carWashSupervisor.id, bergenCarWash.id, { canView: true, canCreate: true, canUpdate: true, canDelete: false, canApprove: false });

  await ensureUserRole(superAdmin.id, "SUPER_ADMIN");
  await ensureUserRole(accountant.id, "ACCOUNTANT");
  await ensureUserRole(deliveryHr.id, "DELIVERY_HR");
  await ensureUserRole(carWashSupervisor.id, "CAR_WASH_SUPERVISOR");

  console.log("Super Admin: admin@rashidgroup.kw / Admin@2025!");
  console.log("Accountant: accountant@rashidgroup.kw / Accountant@2025!");
  console.log("Delivery HR: delivery_hr@rashidgroup.kw / DeliveryHR@2025!");
  console.log("Car Wash Supervisor: carwash_supervisor@rashidgroup.kw / CarWash@2025!");
  console.log("Seeding complete.");
}

async function upsertUser({
  email,
  nameAr,
  nameEn,
  password,
  isSuperAdmin = false,
}: {
  email: string;
  nameAr: string;
  nameEn?: string;
  password: string;
  isSuperAdmin?: boolean;
}) {
  const passwordHash = await hash(password, 12);
  return prisma.user.upsert({
    where: { email },
    update: {
      nameAr,
      nameEn,
      passwordHash,
      isSuperAdmin,
      isActive: true,
    },
    create: {
      email,
      nameAr,
      nameEn,
      passwordHash,
      isSuperAdmin,
      isActive: true,
    },
  });
}

async function upsertCompanyAccess(
  userId: string,
  companyId: string,
  flags: { canView: boolean; canCreate: boolean; canUpdate: boolean; canDelete: boolean; canApprove: boolean }
) {
  await prisma.userCompanyAccess.upsert({
    where: { userId_companyId: { userId, companyId } },
    update: flags,
    create: { userId, companyId, ...flags },
  });
}

async function ensureUserRole(userId: string, roleName: string) {
  const role = await prisma.role.findUnique({ where: { name: roleName } });
  if (!role) return;

  const existing = await prisma.userRole.findFirst({
    where: { userId, roleId: role.id, companyId: null },
  });

  if (!existing) {
    await prisma.userRole.create({
      data: { userId, roleId: role.id },
    });
  }
}

async function seedChartOfAccounts(companyId: string) {
  const accounts = [
    { code: "1", nameAr: "الأصول", type: "ASSET", isHeader: true, level: 1, normalBalance: "DEBIT" },
    { code: "10", nameAr: "الأصول المتداولة", type: "ASSET", isHeader: true, level: 2, normalBalance: "DEBIT", parentCode: "1" },
    { code: "1000", nameAr: "الصندوق / النقدية", type: "ASSET", level: 3, normalBalance: "DEBIT", parentCode: "10", subtype: "current_asset" },
    { code: "1010", nameAr: "البنك - الحساب الجاري", type: "ASSET", level: 3, normalBalance: "DEBIT", parentCode: "10", subtype: "current_asset" },
    { code: "1020", nameAr: "ذمم KNET", type: "ASSET", level: 3, normalBalance: "DEBIT", parentCode: "10", subtype: "current_asset" },
    { code: "1030", nameAr: "ذمم محافظ السائقين", type: "ASSET", level: 3, normalBalance: "DEBIT", parentCode: "10", subtype: "current_asset" },
    { code: "1040", nameAr: "ذمم مدينة أخرى", type: "ASSET", level: 3, normalBalance: "DEBIT", parentCode: "10", subtype: "current_asset" },
    { code: "1050", nameAr: "مصروفات مدفوعة مقدماً", type: "ASSET", level: 3, normalBalance: "DEBIT", parentCode: "10", subtype: "current_asset" },
    { code: "11", nameAr: "الأصول الثابتة", type: "ASSET", isHeader: true, level: 2, normalBalance: "DEBIT", parentCode: "1" },
    { code: "1100", nameAr: "المركبات", type: "ASSET", level: 3, normalBalance: "DEBIT", parentCode: "11", subtype: "fixed_asset" },
    { code: "1101", nameAr: "مجمع إهلاك المركبات", type: "ASSET", level: 3, normalBalance: "CREDIT", parentCode: "11", subtype: "fixed_asset" },
    { code: "1110", nameAr: "معدات وأجهزة", type: "ASSET", level: 3, normalBalance: "DEBIT", parentCode: "11", subtype: "fixed_asset" },
    { code: "2", nameAr: "الالتزامات", type: "LIABILITY", isHeader: true, level: 1, normalBalance: "CREDIT" },
    { code: "20", nameAr: "الالتزامات المتداولة", type: "LIABILITY", isHeader: true, level: 2, normalBalance: "CREDIT", parentCode: "2" },
    { code: "2010", nameAr: "رواتب الموظفين المستحقة", type: "LIABILITY", level: 3, normalBalance: "CREDIT", parentCode: "20", subtype: "current_liability" },
    { code: "2011", nameAr: "رواتب موظفي المستثمرين المستحقة", type: "LIABILITY", level: 3, normalBalance: "CREDIT", parentCode: "20", subtype: "current_liability" },
    { code: "2020", nameAr: "مستحق لجهة حكومية - تجديد رخصة", type: "LIABILITY", level: 3, normalBalance: "CREDIT", parentCode: "20", subtype: "current_liability" },
    { code: "2021", nameAr: "مستحق لجهة حكومية - تجديد إقامة", type: "LIABILITY", level: 3, normalBalance: "CREDIT", parentCode: "20", subtype: "current_liability" },
    { code: "2022", nameAr: "مستحق إيجار", type: "LIABILITY", level: 3, normalBalance: "CREDIT", parentCode: "20", subtype: "current_liability" },
    { code: "2029", nameAr: "مستحقات أخرى للمستثمرين", type: "LIABILITY", level: 3, normalBalance: "CREDIT", parentCode: "20", subtype: "current_liability" },
    { code: "2030", nameAr: "دائنون تجاريون", type: "LIABILITY", level: 3, normalBalance: "CREDIT", parentCode: "20", subtype: "current_liability" },
    { code: "3", nameAr: "حقوق الملكية", type: "EQUITY", isHeader: true, level: 1, normalBalance: "CREDIT" },
    { code: "3010", nameAr: "رأس المال", type: "EQUITY", level: 2, normalBalance: "CREDIT", parentCode: "3" },
    { code: "3020", nameAr: "أرباح مبقاة", type: "EQUITY", level: 2, normalBalance: "CREDIT", parentCode: "3" },
    { code: "3030", nameAr: "حساب جاري مالك", type: "EQUITY", level: 2, normalBalance: "CREDIT", parentCode: "3" },
    { code: "4", nameAr: "الإيرادات", type: "REVENUE", isHeader: true, level: 1, normalBalance: "CREDIT" },
    { code: "4010", nameAr: "إيراد خدمات التوصيل", type: "REVENUE", level: 2, normalBalance: "CREDIT", parentCode: "4", subtype: "operating_revenue" },
    { code: "4011", nameAr: "إيراد طلبات", type: "REVENUE", level: 2, normalBalance: "CREDIT", parentCode: "4", subtype: "operating_revenue" },
    { code: "4012", nameAr: "إيراد Ro Pops", type: "REVENUE", level: 2, normalBalance: "CREDIT", parentCode: "4", subtype: "operating_revenue" },
    { code: "4020", nameAr: "إيراد غسيل السيارات", type: "REVENUE", level: 2, normalBalance: "CREDIT", parentCode: "4", subtype: "operating_revenue" },
    { code: "4030", nameAr: "إيراد خدمات إدارية - مستثمرون", type: "REVENUE", level: 2, normalBalance: "CREDIT", parentCode: "4", subtype: "operating_revenue" },
    { code: "4040", nameAr: "إيرادات أخرى", type: "REVENUE", level: 2, normalBalance: "CREDIT", parentCode: "4", subtype: "other_revenue" },
    { code: "5", nameAr: "المصروفات", type: "EXPENSE", isHeader: true, level: 1, normalBalance: "DEBIT" },
    { code: "50", nameAr: "مصروفات الموارد البشرية", type: "EXPENSE", isHeader: true, level: 2, normalBalance: "DEBIT", parentCode: "5" },
    { code: "5010", nameAr: "رواتب وأجور", type: "EXPENSE", level: 3, normalBalance: "DEBIT", parentCode: "50", subtype: "operating_expense" },
    { code: "5011", nameAr: "حوافز سائقين", type: "EXPENSE", level: 3, normalBalance: "DEBIT", parentCode: "50", subtype: "operating_expense" },
    { code: "5050", nameAr: "تأمين عمالة وطنية", type: "EXPENSE", level: 3, normalBalance: "DEBIT", parentCode: "50", subtype: "operating_expense" },
    { code: "5060", nameAr: "تجديد إقامات", type: "EXPENSE", level: 3, normalBalance: "DEBIT", parentCode: "50", subtype: "operating_expense" },
    { code: "5061", nameAr: "تجديد رخص مهن", type: "EXPENSE", level: 3, normalBalance: "DEBIT", parentCode: "50", subtype: "operating_expense" },
    { code: "5070", nameAr: "تذاكر سفر", type: "EXPENSE", level: 3, normalBalance: "DEBIT", parentCode: "50", subtype: "operating_expense" },
    { code: "51", nameAr: "مصروفات المركبات", type: "EXPENSE", isHeader: true, level: 2, normalBalance: "DEBIT", parentCode: "5" },
    { code: "5020", nameAr: "إيجار سكن سائقين", type: "EXPENSE", level: 3, normalBalance: "DEBIT", parentCode: "51", subtype: "operating_expense" },
    { code: "5021", nameAr: "إيجار سيارات", type: "EXPENSE", level: 3, normalBalance: "DEBIT", parentCode: "51", subtype: "operating_expense" },
    { code: "5030", nameAr: "وقود", type: "EXPENSE", level: 3, normalBalance: "DEBIT", parentCode: "51", subtype: "operating_expense" },
    { code: "5031", nameAr: "صيانة مركبات", type: "EXPENSE", level: 3, normalBalance: "DEBIT", parentCode: "51", subtype: "operating_expense" },
    { code: "5032", nameAr: "أقساط سيارات", type: "EXPENSE", level: 3, normalBalance: "DEBIT", parentCode: "51", subtype: "operating_expense" },
    { code: "5033", nameAr: "اشتراك نظام التتبع", type: "EXPENSE", level: 3, normalBalance: "DEBIT", parentCode: "51", subtype: "operating_expense" },
    { code: "5080", nameAr: "مخالفات مرورية", type: "EXPENSE", level: 3, normalBalance: "DEBIT", parentCode: "51", subtype: "operating_expense" },
    { code: "52", nameAr: "مصروفات إدارية", type: "EXPENSE", isHeader: true, level: 2, normalBalance: "DEBIT", parentCode: "5" },
    { code: "5040", nameAr: "عمولة KNET", type: "EXPENSE", level: 3, normalBalance: "DEBIT", parentCode: "52", subtype: "operating_expense" },
    { code: "5041", nameAr: "هاتف واتصالات", type: "EXPENSE", level: 3, normalBalance: "DEBIT", parentCode: "52", subtype: "operating_expense" },
    { code: "5090", nameAr: "اشتراكات سيرفر", type: "EXPENSE", level: 3, normalBalance: "DEBIT", parentCode: "52", subtype: "administrative_expense" },
    { code: "5091", nameAr: "إيجار جراج", type: "EXPENSE", level: 3, normalBalance: "DEBIT", parentCode: "52", subtype: "operating_expense" },
    { code: "5099", nameAr: "مصروفات أخرى", type: "EXPENSE", level: 3, normalBalance: "DEBIT", parentCode: "52", subtype: "other_expense" },
  ];

  const codeMap = new Map<string, string>();

  for (const account of accounts) {
    const parentId = account.parentCode ? codeMap.get(account.parentCode) : undefined;
    const created = await prisma.chartOfAccount.upsert({
      where: { companyId_code: { companyId, code: account.code } },
      update: {},
      create: {
        companyId,
        code: account.code,
        nameAr: account.nameAr,
        type: account.type as "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE",
        subtype: account.subtype,
        isHeader: account.isHeader ?? false,
        level: account.level,
        normalBalance: account.normalBalance as "DEBIT" | "CREDIT",
        parentId,
      },
    });
    codeMap.set(account.code, created.id);
  }
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
