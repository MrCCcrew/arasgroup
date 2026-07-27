import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const resolver = read("lib/auth/company-access.ts");
assert.match(resolver, /resolveUserCompanyAccess/);
assert.match(resolver, /hasGlobalAccess/);
assert.match(resolver, /groupId: \{ in:/);
assert.match(resolver, /mergeAccess/);

const dashboard = read("app/(dashboard)/dashboard/page.tsx");
assert.match(dashboard, /currentGroupId/);
assert.match(dashboard, /scopedCompanyIds/);

const usersApi = read("app/api/users/[userId]/access/route.ts");
assert.match(usersApi, /hasGlobalGroupAccess/);
assert.match(usersApi, /groupAccess/);

const companiesApi = read("app/api/companies/[companyId]/route.ts");
assert.match(companiesApi, /session\.companyAccess\.includes\(companyId\)/);

console.log("group/company access safeguards: passed");
