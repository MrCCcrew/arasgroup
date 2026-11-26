const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const sourceCompanyId = "co-silver-valley";
const sourceMainLicenseId = "cmqzmph510001l134fej2k1sk";

// These records were moved by mistake.  The correction deliberately keeps a
// fully independent copy in the destination and restores the original record
// (and its original documents) to Silver Valley.
const copies = [
  { licenseId: "cmqzlj4m80003l1qoj5kqzoqi", targetCompanyId: "cmwnu3q5r00k5l1l2l6k3qh9j", label: "Lisciano Fabrics" },
  { licenseId: "cmqzlj4nd0007l1qo19g0ok7h", targetCompanyId: "cmwnu188j00hhl1l2v8d9u1r1", label: "Lisciano Shared" },
  { licenseId: "cmqy4ucto0011l143chnhwhse", targetCompanyId: "cmwntzjce00epl1l2okp6d2xw", label: "Venus Tailor" },
  { licenseId: "cmqzlj4mg0005l1qouqwtjqog", targetCompanyId: "cmwntypkt00bxl1l2igkz259b", label: "Al Jadi Tailor" },
  { licenseId: "cmqy4ucu00013l1439hm946ci", targetCompanyId: "cmwntxibv0095l1l2p0otp121", label: "Al Awhad Tailor" },
];

function omit(row, extra = []) {
  const data = { ...row };
  for (const key of ["id", "licenseId", "createdAt", "updatedAt", ...extra]) delete data[key];
  return data;
}

async function copyRows(tx, model, sourceLicenseId, targetLicenseId) {
  const rows = await tx[model].findMany({ where: { licenseId: sourceLicenseId } });
  for (const row of rows) await tx[model].create({ data: { ...omit(row), licenseId: targetLicenseId } });
  return rows.length;
}

async function copySingleton(tx, model, sourceLicenseId, targetLicenseId) {
  const row = await tx[model].findUnique({ where: { licenseId: sourceLicenseId } });
  if (!row) return 0;
  await tx[model].create({ data: { ...omit(row), licenseId: targetLicenseId } });
  return 1;
}

async function copyEstablishmentContracts(tx, sourceLicenseId, targetLicenseId) {
  const contracts = await tx.establishmentContract.findMany({ where: { licenseId: sourceLicenseId }, include: { partners: true } });
  for (const contract of contracts) {
    const created = await tx.establishmentContract.create({ data: { ...omit(contract, ["partners"]), licenseId: targetLicenseId } });
    for (const partner of contract.partners) await tx.contractPartner.create({ data: { ...omit(partner, ["contractId"]), contractId: created.id } });
  }
  return contracts.length;
}

async function copySignatureCertificate(tx, sourceLicenseId, targetLicenseId) {
  const certificate = await tx.employerSignatureCert.findUnique({ where: { licenseId: sourceLicenseId }, include: { signatories: true } });
  if (!certificate) return 0;
  const created = await tx.employerSignatureCert.create({ data: { ...omit(certificate, ["signatories"]), licenseId: targetLicenseId } });
  for (const signer of certificate.signatories) await tx.authorizedSigner.create({ data: { ...omit(signer, ["certId"]), certId: created.id } });
  return 1;
}

async function cloneLicense(tx, source, targetCompanyId) {
  let clonedAddressId = null;
  if (source.licenseAddressId) {
    const address = await tx.licenseAddress.findUnique({ where: { id: source.licenseAddressId } });
    if (address) {
      const clonedAddress = await tx.licenseAddress.create({ data: omit(address) });
      clonedAddressId = clonedAddress.id;
    }
  }
  const clone = await tx.license.create({
    data: {
      ...omit(source, ["companyId", "branchId", "investorId", "licenseAddressId", "isMainLicense", "mainLicenseId"]),
      companyId: targetCompanyId,
      branchId: null,
      investorId: source.investorId,
      licenseAddressId: clonedAddressId,
      isMainLicense: true,
      mainLicenseId: null,
    },
  });

  const copied = {};
  copied.contracts = await copyEstablishmentContracts(tx, source.id, clone.id);
  copied.leaseContracts = await copyRows(tx, "leaseContract", source.id, clone.id);
  copied.rentReceipts = await copyRows(tx, "licenseRentReceipt", source.id, clone.id);
  copied.vehicles = await copyRows(tx, "licenseVehicle", source.id, clone.id);
  copied.violations = await copyRows(tx, "licenseViolation", source.id, clone.id);
  copied.partnerCivilIds = await copyRows(tx, "licensePartnerCivilId", source.id, clone.id);
  copied.documentVersions = await copyRows(tx, "licenseDocumentVersion", source.id, clone.id);
  copied.workInjuryInsurances = await copyRows(tx, "workInjuryInsurance", source.id, clone.id);
  copied.annualBalances = await copyRows(tx, "licenseAnnualBalance", source.id, clone.id);
  copied.signature = await copySignatureCertificate(tx, source.id, clone.id);
  for (const model of ["importLicenseDoc", "licenseAdvertisingDetails", "licenseFireSafetyCert", "licenseHealthLicense", "licenseChamberOfCommerceCert", "licenseTrafficCert", "licenseCustomsCert", "managerPOA"]) {
    copied[model] = await copySingleton(tx, model, source.id, clone.id);
  }

  const attachments = await tx.attachment.findMany({ where: { companyId: targetCompanyId, refModule: "LICENSE", refId: source.id } });
  for (const attachment of attachments) {
    await tx.attachment.create({ data: { ...omit(attachment), companyId: targetCompanyId, branchId: null, refId: clone.id, entityId: attachment.entityId === source.id ? clone.id : attachment.entityId } });
  }
  copied.attachments = attachments.length;
  return { cloneId: clone.id, copied };
}

async function main() {
  const licenseIds = copies.map((item) => item.licenseId);
  const [licenses, targets, mainLicense] = await Promise.all([
    prisma.license.findMany({ where: { id: { in: licenseIds } } }),
    prisma.company.findMany({ where: { id: { in: copies.map((item) => item.targetCompanyId) }, isActive: true }, select: { id: true } }),
    prisma.license.findFirst({ where: { id: sourceMainLicenseId, companyId: sourceCompanyId }, select: { id: true } }),
  ]);
  if (licenses.length !== copies.length || licenses.some((license) => !copies.some((item) => item.licenseId === license.id && item.targetCompanyId === license.companyId))) throw new Error("The moved licenses are not in their expected destination companies; no changes were made.");
  if (targets.length !== copies.length || !mainLicense) throw new Error("A destination company or Silver Valley main license is missing; no changes were made.");

  const result = await prisma.$transaction(async (tx) => {
    const restored = [];
    for (const item of copies) {
      const source = await tx.license.findUniqueOrThrow({ where: { id: item.licenseId } });
      // Free the destination company's unique license number first. The source
      // object above is intentionally retained as the exact template to copy.
      await tx.license.update({ where: { id: source.id }, data: { companyId: sourceCompanyId, branchId: null, isMainLicense: false, mainLicenseId: sourceMainLicenseId } });
      const cloned = await cloneLicense(tx, source, item.targetCompanyId);
      const restoredAttachments = await tx.attachment.updateMany({ where: { companyId: item.targetCompanyId, refModule: "LICENSE", refId: source.id }, data: { companyId: sourceCompanyId } });
      restored.push({ label: item.label, originalLicenseId: source.id, targetCopyLicenseId: cloned.cloneId, restoredAttachments: restoredAttachments.count, copied: cloned.copied });
    }
    return restored;
  }, { timeout: 120000 });

  const verification = await Promise.all(copies.map(async (item) => ({
    label: item.label,
    sourceOriginal: await prisma.license.count({ where: { id: item.licenseId, companyId: sourceCompanyId, isMainLicense: false, mainLicenseId: sourceMainLicenseId } }),
    targetCopies: await prisma.license.count({ where: { companyId: item.targetCompanyId, isMainLicense: true } }),
    sourceAttachments: await prisma.attachment.count({ where: { companyId: sourceCompanyId, refModule: "LICENSE", refId: item.licenseId } }),
  })));
  console.log(JSON.stringify({ success: true, restored: result, verification }, null, 2));
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(() => prisma.$disconnect());
