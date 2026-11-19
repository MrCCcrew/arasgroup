const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const moves = [
  { source: "cmrjqd9jd00dbl1ehqefzgvok", target: "cmqr2gbj4001vl159k5dy4o2f", label: "Eagle" },
  { source: "cmrjqa5o400d9l1ehkli90o67", target: "cmqzpqfon0001l1m7svaaxr43", label: "IT Delivery" },
];
const bergen = { license: "cmqzlj4oj000jl1qovugcvaky", company: "co-bergen-carwash" };
const omit = (row) => { const { id, licenseId, createdAt, updatedAt, ...data } = row; return data; };

async function mergeSingleton(tx, model, sourceId, targetId) {
  const record = await tx[model].findUnique({ where: { licenseId: sourceId } });
  if (!record) return 0;
  const data = omit(record);
  await tx[model].upsert({ where: { licenseId: targetId }, create: { ...data, licenseId: targetId }, update: data });
  await tx[model].delete({ where: { id: record.id } });
  return 1;
}

async function mergeLicense(tx, sourceId, targetId) {
  const source = await tx.license.findUnique({ where: { id: sourceId } });
  const target = await tx.license.findUnique({ where: { id: targetId } });
  if (!source || !target) throw new Error("Source or target license was not found");
  const { id, companyId, branchId, investorId, licenseAddressId, isMainLicense, mainLicenseId, createdAt, updatedAt, ...licenseData } = source;
  await tx.license.update({ where: { id: sourceId }, data: { licenseAddressId: null } });
  await tx.license.update({ where: { id: targetId }, data: { ...licenseData, investorId: source.investorId, licenseAddressId: source.licenseAddressId } });

  await tx.establishmentContract.updateMany({ where: { licenseId: sourceId }, data: { licenseId: targetId } });
  await tx.leaseContract.updateMany({ where: { licenseId: sourceId }, data: { licenseId: targetId } });
  await tx.licenseRentReceipt.updateMany({ where: { licenseId: sourceId }, data: { licenseId: targetId } });
  await tx.licenseVehicle.updateMany({ where: { licenseId: sourceId }, data: { licenseId: targetId } });
  await tx.licenseViolation.updateMany({ where: { licenseId: sourceId }, data: { licenseId: targetId } });
  await tx.licensePartnerCivilId.updateMany({ where: { licenseId: sourceId }, data: { licenseId: targetId } });
  await tx.employee.updateMany({ where: { licenseId: sourceId }, data: { licenseId: targetId } });
  await tx.notification.updateMany({ where: { licenseId: sourceId }, data: { licenseId: targetId } });
  const assignments = await tx.employeeLicenseAssignment.findMany({ where: { licenseId: sourceId } });
  for (const assignment of assignments) {
    const exists = await tx.employeeLicenseAssignment.findFirst({ where: { employeeId: assignment.employeeId, licenseId: targetId } });
    if (exists) await tx.employeeLicenseAssignment.delete({ where: { id: assignment.id } }); else await tx.employeeLicenseAssignment.update({ where: { id: assignment.id }, data: { licenseId: targetId } });
  }
  const versions = await tx.licenseDocumentVersion.findMany({ where: { licenseId: sourceId }, orderBy: { version: "asc" } });
  for (const version of versions) {
    const duplicate = await tx.licenseDocumentVersion.findFirst({ where: { licenseId: targetId, sectionType: version.sectionType, version: version.version } });
    if (!duplicate) await tx.licenseDocumentVersion.update({ where: { id: version.id }, data: { licenseId: targetId } });
    else { const max = await tx.licenseDocumentVersion.aggregate({ where: { licenseId: targetId, sectionType: version.sectionType }, _max: { version: true } }); await tx.licenseDocumentVersion.update({ where: { id: version.id }, data: { licenseId: targetId, version: (max._max.version ?? 0) + 1 } }); }
  }
  for (const model of ["employerSignatureCert", "importLicenseDoc", "licenseAdvertisingDetails", "licenseFireSafetyCert", "licenseHealthLicense", "licenseTrafficCert", "licenseCustomsCert", "managerPOA"]) await mergeSingleton(tx, model, sourceId, targetId);
  for (const [model, keys] of [["workInjuryInsurance", ["year", "quarter"]], ["licenseAnnualBalance", ["year"]]]) {
    const rows = await tx[model].findMany({ where: { licenseId: sourceId } });
    for (const row of rows) { const where = { licenseId_year_quarter: { licenseId: targetId, year: row.year, quarter: row.quarter } }; if (model === "licenseAnnualBalance") { const targetRow = await tx.licenseAnnualBalance.findUnique({ where: { licenseId_year: { licenseId: targetId, year: row.year } } }); if (targetRow) { await tx.licenseAnnualBalance.update({ where: { id: targetRow.id }, data: omit(row) }); await tx.licenseAnnualBalance.delete({ where: { id: row.id } }); } else await tx.licenseAnnualBalance.update({ where: { id: row.id }, data: { licenseId: targetId } }); } else { const targetRow = await tx.workInjuryInsurance.findUnique({ where }); if (targetRow) { await tx.workInjuryInsurance.update({ where: { id: targetRow.id }, data: omit(row) }); await tx.workInjuryInsurance.delete({ where: { id: row.id } }); } else await tx.workInjuryInsurance.update({ where: { id: row.id }, data: { licenseId: targetId } }); } }
  }
  await tx.license.delete({ where: { id: sourceId } });
}

(async () => {
  await prisma.$transaction(async tx => { for (const move of moves) await mergeLicense(tx, move.source, move.target); const license = await tx.license.findUnique({ where: { id: bergen.license } }); if (!license) throw new Error("Bergen license not found"); await tx.license.update({ where: { id: bergen.license }, data: { companyId: bergen.company, branchId: null, isMainLicense: true, mainLicenseId: null } }); });
  console.log(JSON.stringify({ success: true, merged: moves.map(move => move.label), moved: "Bergen car wash" }));
})().catch(error => { console.error(error); process.exit(1); }).finally(() => prisma.$disconnect());
