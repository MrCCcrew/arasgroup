import assert from "node:assert/strict";
import { companyTypeAllowsModule, getVisibleModules, hasPermission } from "../lib/auth/permissions";
import type { SessionUser } from "../lib/types";

const companyId = "construction-company";
const employee: SessionUser = {
  id: "site-user", email: "site@example.invalid", nameAr: "موظف موقع", isSuperAdmin: false,
  roles: [{ name: "CONTRACTING_SITE_EMPLOYEE", companyId }], groupAccess: [], companyAccess: [companyId],
  companyAccessEntries: [{ companyId, canView: true, canCreate: true, canUpdate: false, canDelete: false, canApprove: false }],
  branchAccess: [], permissions: [],
};

assert(companyTypeAllowsModule("CONTRACTING", "CONTRACTING"));
assert(companyTypeAllowsModule("CONTRACTING", "CONTRACTING_SUBMISSIONS"));
assert(!companyTypeAllowsModule("DELIVERY", "CONTRACTING"));
assert(getVisibleModules(employee, "CONTRACTING").includes("CONTRACTING_SUBMISSIONS"));
assert(hasPermission(employee, "CONTRACTING_SUBMISSIONS", "VIEW", { companyId }));
assert(hasPermission(employee, "CONTRACTING_SUBMISSIONS", "CREATE", { companyId }));
assert(hasPermission(employee, "ATTACHMENTS", "UPLOAD", { companyId }));
assert(!hasPermission(employee, "CONTRACTING", "CREATE", { companyId }));
assert(!hasPermission(employee, "CONTRACTING", "UPDATE", { companyId }));
assert(!hasPermission(employee, "ACCOUNTING", "VIEW", { companyId }));
console.log("PASS: contracting site employee can upload project documents without project or accounting access");
