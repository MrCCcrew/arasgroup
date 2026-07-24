import { PermissionScope, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const permissionDefinitions = [
  ["DRIVER_ACCOUNTS", "VIEW", PermissionScope.COMPANY],
  ["DRIVER_ACCOUNTS", "CREATE", PermissionScope.COMPANY],
  ["DRIVER_ACCOUNTS", "UPDATE", PermissionScope.COMPANY],
  ["DRIVER_ACCOUNTS", "DISABLE", PermissionScope.COMPANY],
  ["DRIVER_ACCOUNTS", "RESET_PASSWORD", PermissionScope.COMPANY],
  ["DRIVER_INVOICES", "VIEW", PermissionScope.COMPANY],
  ["DRIVER_INVOICES", "APPROVE", PermissionScope.COMPANY],
  ["DRIVER_INVOICES", "REJECT", PermissionScope.COMPANY],
  ["DRIVER_INVOICES", "UPDATE", PermissionScope.COMPANY],
  ["DRIVER_INVOICES", "DELETE", PermissionScope.COMPANY],
  ["DRIVER_TRACKING", "VIEW", PermissionScope.COMPANY],
  ["DRIVER_TRACKING", "VIEW_HISTORY", PermissionScope.COMPANY],
  ["DRIVER_TRACKING", "END_SESSION", PermissionScope.COMPANY],
  ["DRIVER_TRACKING", "DELETE", PermissionScope.COMPANY],
  ["AUDIT_LOGS", "VIEW", PermissionScope.GROUP],
] as const;

const moduleNames = [...new Set(permissionDefinitions.map(([module]) => module))];
const isDryRun = process.argv.includes("--dry-run");

function printSuccess(prefix: string) {
  console.log(`${prefix}: ${permissionDefinitions.length} permission definitions verified.`);
  console.log(`Modules: ${moduleNames.join(", ")}`);
  console.log("Status: success");
}

async function main() {
  if (isDryRun) {
    printSuccess("Dry run");
    return;
  }

  for (const [module, action, scope] of permissionDefinitions) {
    await prisma.permission.upsert({
      where: { module_action_scope: { module, action, scope } },
      update: {},
      create: { module, action, scope },
    });
  }

  printSuccess("Permission seed");
}

main()
  .catch(() => {
    console.error("Permission seed failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
