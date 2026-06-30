import { NextRequest, NextResponse } from "next/server";
import type { EmployeeType, License } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertCompanyAccess, requireRequestSession } from "@/lib/auth/access";
import {
  buildWorkbook,
  parseWorkbook,
  validateRequired,
  parseDate,
  formatDateForExcel,
  EMPLOYEE_TYPE_LABELS,
  EMPLOYEE_TYPE_DISPLAY,
  parseEnum,
  normalizeLookupValue,
  normalizeLicenseNumber,
  type ColDef,
  type ImportResult,
} from "@/lib/excel/import-export";

const COLS: ColDef[] = [
  { header: "اسم المسئول *", key: "investorName", required: true, width: 25, example: "أحمد محمد" },
  { header: "الاسم بالعربية *", key: "nameAr", required: true, width: 25, example: "عبدالله أحمد" },
  { header: "الاسم بالإنجليزية", key: "nameEn", width: 25, example: "Abdullah Ahmed" },
  { header: "نوع الموظف *", key: "type", required: true, width: 18, example: "موظف مكتب" },
  { header: "الجنسية", key: "nationality", width: 15, example: "مصري" },
  { header: "رقم الهوية المدنية", key: "civilId", width: 15, example: "287654321098" },
  { header: "رقم جواز السفر", key: "passportNumber", width: 18, example: "A1234567" },
  { header: "تاريخ انتهاء الجواز", key: "passportExpiryDate", width: 18, example: "31/12/2028" },
  { header: "رقم الإقامة", key: "residencyNumber", width: 18, example: "123456789012" },
  { header: "تاريخ انتهاء الإقامة", key: "residencyExpiry", width: 18, example: "15/06/2026" },
  { header: "رقم رخصة القيادة", key: "licenseNumber", width: 18, example: "KW-123456" },
  { header: "تاريخ انتهاء الرخصة", key: "licenseExpiry", width: 18, example: "01/01/2027" },
  { header: "الهاتف", key: "phone", width: 14, example: "65001234" },
  { header: "المسمى الوظيفي", key: "jobTitle", width: 20, example: "مدير إداري" },
  { header: "الراتب الأساسي", key: "baseSalary", width: 14, example: "250.000" },
  { header: "تاريخ الالتحاق", key: "joinDate", width: 16, example: "01/09/2023" },
  { header: "رقم الحساب البنكي", key: "bankAccountNumber", width: 20, example: "KW12NBOK..." },
  { header: "الترخيص", key: "licenseName", width: 30, example: "الدرة الكبيرة للملابس الجاهزة (2026/3950)" },
  { header: "الفرع", key: "branchName", width: 20, example: "الفرع الرئيسي" },
  { header: "ملاحظات", key: "notes", width: 30, example: "" },
  { header: "رقم الموظف", key: "employeeNumber", width: 18, example: "EMP-301" },
  { header: "الرخصة الرئيسية", key: "mainLicenseName", width: 34, example: "شركة الوادي الفضي للتجارة العامة (2016/628)" },
  { header: "الرخصة الفرعية", key: "subLicenseName", width: 34, example: "الدرة الكبيرة للملابس الجاهزة (2026/3950)" },
  { header: "رخصة إقامة الموظف", key: "residencyLicenseName", width: 34, example: "شركة الوادي الفضي للتجارة العامة (2016/628)" },
  { header: "رخصة العمل الفعلية للموظف", key: "workPermitLicenseName", width: 34, example: "الدرة الكبيرة للملابس الجاهزة (2026/3950)" },
  { header: "اسم المفوض", key: "signatoryName", width: 28, example: "محمد أحمد" },
];

const EMPLOYEE_TYPES = [
  "DRIVER",
  "DELIVERY_DRIVER",
  "DELIVERY_ADMIN",
  "CAR_WASH_DRIVER",
  "CAR_WASH_WORKER",
  "OFFICE_EMPLOYEE",
  "ACCOUNTANT",
  "MANDOUB",
  "OFFICE_BOY",
  "OTHER",
] as EmployeeType[];

type SignatoryRef = { signatories: Array<{ nameAr: string }> };

type LicenseLookup = Pick<License, "id" | "commercialNameAr" | "licenseNumber" | "isMainLicense" | "mainLicenseId"> & {
  employerSignatureCert?: SignatoryRef | null;
  mainLicense?: {
    id: string;
    commercialNameAr: string;
    licenseNumber: string;
    employerSignatureCert?: SignatoryRef | null;
  } | null;
};

function formatLicenseLabel(license: { commercialNameAr: string; licenseNumber: string }) {
  return `${license.commercialNameAr} (${license.licenseNumber})`;
}

function collectSignatoryNames(
  ...licenses: Array<{
    employerSignatureCert?: SignatoryRef | null;
  } | null | undefined>
) {
  const names: string[] = [];
  const seen = new Set<string>();

  for (const license of licenses) {
    for (const signatory of license?.employerSignatureCert?.signatories ?? []) {
      const name = signatory.nameAr.trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      names.push(name);
    }
  }

  return names.join("، ");
}

function dedupeLicenses<T extends { id: string }>(licenses: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const license of licenses) {
    if (seen.has(license.id)) continue;
    seen.add(license.id);
    result.push(license);
  }
  return result;
}

function buildLicenseMaps(licenses: LicenseLookup[]) {
  const anyMap = new Map<string, LicenseLookup>();
  const mainMap = new Map<string, LicenseLookup>();
  const subMap = new Map<string, LicenseLookup>();

  for (const license of licenses) {
    const targets = [anyMap, license.isMainLicense ? mainMap : subMap];
    const keys = [
      normalizeLookupValue(license.commercialNameAr),
      normalizeLicenseNumber(license.licenseNumber),
      normalizeLookupValue(formatLicenseLabel(license)),
    ].filter(Boolean);

    for (const target of targets) {
      for (const key of keys) {
        if (!target.has(key)) {
          target.set(key, license);
        }
      }
    }
  }

  return { anyMap, mainMap, subMap };
}

function resolveLicenseValue(
  value: string,
  maps: ReturnType<typeof buildLicenseMaps>,
  mode: "any" | "main" | "sub" = "any",
) {
  const normalizedName = normalizeLookupValue(value);
  const normalizedNumber = normalizeLicenseNumber(value);
  const source = mode === "main" ? maps.mainMap : mode === "sub" ? maps.subMap : maps.anyMap;

  return (
    source.get(normalizedName) ??
    source.get(normalizedNumber) ??
    null
  );
}

function classifyEmployeeLicenses(employee: {
  license: {
    id: string;
    commercialNameAr: string;
    licenseNumber: string;
    isMainLicense: boolean;
    employerSignatureCert?: SignatoryRef | null;
    mainLicense?: {
      id: string;
      commercialNameAr: string;
      licenseNumber: string;
      employerSignatureCert?: SignatoryRef | null;
    } | null;
  } | null;
  licenseAssignments: Array<{
    license: {
      id: string;
      commercialNameAr: string;
      licenseNumber: string;
      isMainLicense: boolean;
      employerSignatureCert?: SignatoryRef | null;
      mainLicense?: {
        id: string;
        commercialNameAr: string;
        licenseNumber: string;
        employerSignatureCert?: SignatoryRef | null;
      } | null;
    };
  }>;
}) {
  const assignedLicenses = dedupeLicenses([
    ...(employee.license ? [employee.license] : []),
    ...employee.licenseAssignments.map((assignment) => assignment.license),
  ]);

  const mainLicense =
    assignedLicenses.find((license) => license.isMainLicense) ??
    assignedLicenses.find((license) => !license.isMainLicense && license.mainLicense)?.mainLicense ??
    null;

  const subLicense = assignedLicenses.find((license) => !license.isMainLicense) ?? null;

  return { mainLicense, subLicense };
}

export async function GET(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const { searchParams } = request.nextUrl;
  const companyId = searchParams.get("companyId");
  const mode = searchParams.get("mode") ?? "template";

  if (!companyId) {
    return NextResponse.json({ error: "companyId مطلوب" }, { status: 400 });
  }

  const accessError = assertCompanyAccess(session, companyId);
  if (accessError) return accessError;

  let rows: Record<string, unknown>[] = [];

  if (mode === "export") {
    const employees = await prisma.employee.findMany({
      where: {
        companyId,
        isActive: true,
        isDeleted: false,
        investorId: { not: null },
      },
      include: {
        investor: { select: { nameAr: true } },
        license: {
          select: {
            id: true,
            commercialNameAr: true,
            licenseNumber: true,
            isMainLicense: true,
            employerSignatureCert: { select: { signatories: { select: { nameAr: true }, orderBy: { sortOrder: "asc" } } } },
            mainLicense: {
              select: {
                id: true,
                commercialNameAr: true,
                licenseNumber: true,
                employerSignatureCert: { select: { signatories: { select: { nameAr: true }, orderBy: { sortOrder: "asc" } } } },
              },
            },
          },
        },
        residencyLicense: { select: { commercialNameAr: true, licenseNumber: true } },
        workPermitLicense: { select: { commercialNameAr: true, licenseNumber: true } },
        branch: { select: { nameAr: true } },
        licenseAssignments: {
          select: {
            license: {
              select: {
                id: true,
                commercialNameAr: true,
                licenseNumber: true,
                isMainLicense: true,
                employerSignatureCert: { select: { signatories: { select: { nameAr: true }, orderBy: { sortOrder: "asc" } } } },
                mainLicense: {
                  select: {
                    id: true,
                    commercialNameAr: true,
                    licenseNumber: true,
                    employerSignatureCert: { select: { signatories: { select: { nameAr: true }, orderBy: { sortOrder: "asc" } } } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ investor: { nameAr: "asc" } }, { nameAr: "asc" }],
    });

    rows = employees.map((employee) => {
      const { mainLicense, subLicense } = classifyEmployeeLicenses(employee);
      const signatoryName = collectSignatoryNames(employee.license, subLicense, mainLicense);

      return {
        investorName: employee.investor?.nameAr ?? "",
        nameAr: employee.nameAr,
        nameEn: employee.nameEn ?? "",
        type: EMPLOYEE_TYPE_DISPLAY[employee.type] ?? employee.type,
        nationality: employee.nationality ?? "",
        civilId: employee.civilId ?? "",
        passportNumber: employee.passportNumber ?? "",
        passportExpiryDate: formatDateForExcel(employee.passportExpiryDate),
        residencyNumber: employee.residencyNumber ?? "",
        residencyExpiry: formatDateForExcel(employee.residencyExpiry),
        licenseNumber: employee.licenseNumber ?? "",
        licenseExpiry: formatDateForExcel(employee.licenseExpiry),
        phone: employee.phone ?? "",
        jobTitle: employee.jobTitle ?? "",
        baseSalary: employee.baseSalary ? Number(employee.baseSalary) : "",
        joinDate: formatDateForExcel(employee.joinDate),
        bankAccountNumber: employee.bankAccountNumber ?? "",
        licenseName: employee.license ? formatLicenseLabel(employee.license) : "",
        branchName: employee.branch?.nameAr ?? "",
        notes: employee.notes ?? "",
        employeeNumber: employee.employeeNumber ?? "",
        mainLicenseName: mainLicense ? formatLicenseLabel(mainLicense) : "",
        subLicenseName: subLicense ? formatLicenseLabel(subLicense) : "",
        residencyLicenseName: employee.residencyLicense ? formatLicenseLabel(employee.residencyLicense) : "",
        workPermitLicenseName: employee.workPermitLicense ? formatLicenseLabel(employee.workPermitLicense) : "",
        signatoryName,
      };
    });
  }

  const buf = buildWorkbook(COLS, rows, "موظفي المسئولين والمديرين", mode === "template");
  const filename = mode === "export" ? "investor-employees-export.xlsx" : "investor-employees-template.xlsx";

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const { searchParams } = request.nextUrl;
  const companyId = searchParams.get("companyId");
  if (!companyId) {
    return NextResponse.json({ error: "companyId مطلوب" }, { status: 400 });
  }

  const accessError = assertCompanyAccess(session, companyId);
  if (accessError) return accessError;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "الملف مطلوب" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const parsedRows = parseWorkbook(buf, COLS);
  const requiredErrors = validateRequired(parsedRows, COLS);
  if (requiredErrors.length > 0) {
    return NextResponse.json({ success: false, errors: requiredErrors });
  }

  const [investors, licenses, branches] = await Promise.all([
    prisma.investor.findMany({
      where: { isActive: true, companies: { some: { id: companyId } } },
      select: { id: true, nameAr: true },
    }),
    prisma.license.findMany({
      where: { companyId, status: "ACTIVE" },
      select: {
        id: true,
        commercialNameAr: true,
        licenseNumber: true,
        isMainLicense: true,
        mainLicenseId: true,
        employerSignatureCert: { select: { signatories: { select: { nameAr: true }, orderBy: { sortOrder: "asc" } } } },
        mainLicense: {
          select: {
            id: true,
            commercialNameAr: true,
            licenseNumber: true,
            employerSignatureCert: { select: { signatories: { select: { nameAr: true }, orderBy: { sortOrder: "asc" } } } },
          },
        },
      },
    }),
    prisma.branch.findMany({
      where: { companyId, isActive: true },
      select: { id: true, nameAr: true },
    }),
  ]);

  const investorMap = Object.fromEntries(investors.map((investor) => [normalizeLookupValue(investor.nameAr), investor.id]));
  const branchMap = Object.fromEntries(branches.map((branch) => [normalizeLookupValue(branch.nameAr), branch.id]));
  const licenseMaps = buildLicenseMaps(licenses);

  const result: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };

  for (const { rowIndex, data } of parsedRows) {
    const investorId = investorMap[normalizeLookupValue(data.investorName)];
    if (!investorId) {
      result.errors.push({
        row: rowIndex,
        field: "اسم المسئول",
        message: `الصف ${rowIndex}: المسئول "${data.investorName}" غير موجود`,
      });
      continue;
    }

    const employeeType = parseEnum(data.type, EMPLOYEE_TYPE_LABELS, EMPLOYEE_TYPES);
    if (!employeeType) {
      result.errors.push({
        row: rowIndex,
        field: "نوع الموظف",
        message: `الصف ${rowIndex}: نوع الموظف "${data.type}" غير صحيح`,
      });
      continue;
    }

    const branchId = data.branchName ? (branchMap[normalizeLookupValue(data.branchName)] ?? null) : null;
    if (data.branchName && !branchId) {
      result.errors.push({
        row: rowIndex,
        field: "الفرع",
        message: `الصف ${rowIndex}: الفرع "${data.branchName}" غير موجود`,
      });
      continue;
    }

    const genericLicense = data.licenseName ? resolveLicenseValue(data.licenseName, licenseMaps, "any") : null;
    const mainLicense = data.mainLicenseName ? resolveLicenseValue(data.mainLicenseName, licenseMaps, "main") : null;
    const subLicense = data.subLicenseName ? resolveLicenseValue(data.subLicenseName, licenseMaps, "sub") : null;
    const residencyLicense = data.residencyLicenseName ? resolveLicenseValue(data.residencyLicenseName, licenseMaps, "any") : null;
    const workPermitLicense = data.workPermitLicenseName ? resolveLicenseValue(data.workPermitLicenseName, licenseMaps, "any") : null;

    for (const [value, resolved, field] of [
      [data.licenseName, genericLicense, "الترخيص"],
      [data.mainLicenseName, mainLicense, "الرخصة الرئيسية"],
      [data.subLicenseName, subLicense, "الرخصة الفرعية"],
      [data.residencyLicenseName, residencyLicense, "رخصة إقامة الموظف"],
      [data.workPermitLicenseName, workPermitLicense, "رخصة العمل الفعلية للموظف"],
    ] as const) {
      if (value && !resolved) {
        result.errors.push({
          row: rowIndex,
          field,
          message: `الصف ${rowIndex}: ${field} "${value}" غير موجودة`,
        });
        continue;
      }
    }

    if (
      (data.licenseName && !genericLicense) ||
      (data.mainLicenseName && !mainLicense) ||
      (data.subLicenseName && !subLicense) ||
      (data.residencyLicenseName && !residencyLicense) ||
      (data.workPermitLicenseName && !workPermitLicense)
    ) {
      continue;
    }

    const primaryLicenseId = genericLicense?.id ?? subLicense?.id ?? mainLicense?.id ?? null;
    const additionalLicenseIds = Array.from(
      new Set(
        [mainLicense?.id, subLicense?.id]
          .filter((licenseId): licenseId is string => Boolean(licenseId))
          .filter((licenseId) => licenseId !== primaryLicenseId),
      ),
    );

    const payload = {
      companyId,
      investorId,
      branchId,
      licenseId: primaryLicenseId,
      residencyLicenseId: residencyLicense?.id ?? null,
      workPermitLicenseId: workPermitLicense?.id ?? null,
      employeeNumber: data.employeeNumber || null,
      nameAr: data.nameAr,
      nameEn: data.nameEn || null,
      type: employeeType,
      nationality: data.nationality || null,
      civilId: data.civilId || null,
      passportNumber: data.passportNumber || null,
      passportExpiryDate: parseDate(data.passportExpiryDate),
      residencyNumber: data.residencyNumber || null,
      residencyExpiry: parseDate(data.residencyExpiry),
      licenseNumber: data.licenseNumber || null,
      licenseExpiry: parseDate(data.licenseExpiry),
      phone: data.phone || null,
      jobTitle: data.jobTitle || null,
      baseSalary: data.baseSalary ? Number(data.baseSalary) : null,
      joinDate: parseDate(data.joinDate),
      bankAccountNumber: data.bankAccountNumber || null,
      notes: data.notes || null,
    };

    try {
      const existing = data.civilId
        ? await prisma.employee.findFirst({
            where: { companyId, civilId: data.civilId, isDeleted: false },
            select: { id: true },
          })
        : null;

      if (existing) {
        await prisma.$transaction(async (tx) => {
          await tx.employee.update({
            where: { id: existing.id },
            data: payload,
          });

          await tx.employeeLicenseAssignment.deleteMany({ where: { employeeId: existing.id } });
          if (additionalLicenseIds.length > 0) {
            await tx.employeeLicenseAssignment.createMany({
              data: additionalLicenseIds.map((licenseId) => ({ employeeId: existing.id, licenseId })),
              skipDuplicates: true,
            });
          }
        });

        result.updated++;
        continue;
      }

      await prisma.$transaction(async (tx) => {
        const created = await tx.employee.create({ data: payload });
        if (additionalLicenseIds.length > 0) {
          await tx.employeeLicenseAssignment.createMany({
            data: additionalLicenseIds.map((licenseId) => ({ employeeId: created.id, licenseId })),
            skipDuplicates: true,
          });
        }
      });

      result.created++;
    } catch (error) {
      result.errors.push({
        row: rowIndex,
        message: `الصف ${rowIndex}: ${error instanceof Error ? error.message : "خطأ غير متوقع"}`,
      });
    }
  }

  return NextResponse.json({ success: true, ...result });
}
