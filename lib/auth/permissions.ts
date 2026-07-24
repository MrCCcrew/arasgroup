import type {
  SessionBranchAccess,
  SessionCompanyAccess,
  SessionPermission,
  SessionUser,
} from "@/lib/types";

export type Module =
  | "DASHBOARD"
  | "COMPANIES"
  | "BRANCHES"
  | "ADMINISTRATIVE_AFFAIRS"
  | "LICENSES"
  | "ACCOUNTING"
  | "OWNER_ACCOUNTING"
  | "INVESTOR_ACCOUNTING"
  | "BANKS"
  | "HR"
  | "EMPLOYEES"
  | "SALARIES"
  | "DELIVERY_HR"
  | "DELIVERY_OPERATIONS"
  | "DELIVERY_INVOICES"
  | "DELIVERY_REPORTS"
  | "DELIVERY_EXPENSES"
  | "CAR_WASH_HR"
  | "CAR_WASH_OPERATIONS"
  | "CAR_WASH_REPORTS"
  | "CAR_WASH_EXPENSES"
  | "VEHICLES"
  | "ASSETS_CUSTODY"
  | "ATTACHMENTS"
  | "INVESTORS"
  | "INVESTOR_CLAIMS"
  | "INVESTOR_STATEMENTS"
  | "EXPENSES"
  | "REPORTS"
  | "NOTIFICATIONS"
  | "TASKS"
  | "SETTINGS"
  | "USERS"
  | "AUDIT_LOGS"
  | "DRIVER_ACCOUNTS";

export type Action =
  | "VIEW"
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "APPROVE"
  | "EXPORT"
  | "PRINT"
  | "UPLOAD"
  | "DOWNLOAD"
  | "ASSIGN"
  | "RETURN"
  | "COLLECT"
  | "PAY"
  | "RESOLVE";

export type Scope = "GROUP" | "COMPANY" | "BRANCH" | "OWN";
export type PermissionDefinition = { module: Module; action: Action; scope: Scope };

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  { module: "DASHBOARD", action: "VIEW", scope: "GROUP" },
  { module: "COMPANIES", action: "VIEW", scope: "GROUP" },
  { module: "COMPANIES", action: "CREATE", scope: "GROUP" },
  { module: "COMPANIES", action: "UPDATE", scope: "GROUP" },
  { module: "BRANCHES", action: "VIEW", scope: "COMPANY" },
  { module: "BRANCHES", action: "CREATE", scope: "COMPANY" },
  { module: "BRANCHES", action: "UPDATE", scope: "COMPANY" },
  { module: "ADMINISTRATIVE_AFFAIRS", action: "VIEW", scope: "COMPANY" },
  { module: "ADMINISTRATIVE_AFFAIRS", action: "CREATE", scope: "COMPANY" },
  { module: "ADMINISTRATIVE_AFFAIRS", action: "UPDATE", scope: "COMPANY" },
  { module: "ADMINISTRATIVE_AFFAIRS", action: "DELETE", scope: "COMPANY" },
  { module: "ADMINISTRATIVE_AFFAIRS", action: "EXPORT", scope: "COMPANY" },
  { module: "ADMINISTRATIVE_AFFAIRS", action: "PRINT", scope: "COMPANY" },
  { module: "LICENSES", action: "VIEW", scope: "COMPANY" },
  { module: "LICENSES", action: "CREATE", scope: "COMPANY" },
  { module: "LICENSES", action: "UPDATE", scope: "COMPANY" },
  { module: "LICENSES", action: "DELETE", scope: "COMPANY" },
  { module: "LICENSES", action: "EXPORT", scope: "COMPANY" },
  { module: "LICENSES", action: "PRINT", scope: "COMPANY" },
  { module: "ACCOUNTING", action: "VIEW", scope: "COMPANY" },
  { module: "ACCOUNTING", action: "CREATE", scope: "COMPANY" },
  { module: "ACCOUNTING", action: "UPDATE", scope: "COMPANY" },
  { module: "ACCOUNTING", action: "DELETE", scope: "COMPANY" },
  { module: "ACCOUNTING", action: "APPROVE", scope: "COMPANY" },
  { module: "ACCOUNTING", action: "EXPORT", scope: "COMPANY" },
  { module: "ACCOUNTING", action: "PRINT", scope: "COMPANY" },
  { module: "OWNER_ACCOUNTING", action: "VIEW", scope: "COMPANY" },
  { module: "OWNER_ACCOUNTING", action: "CREATE", scope: "COMPANY" },
  { module: "OWNER_ACCOUNTING", action: "UPDATE", scope: "COMPANY" },
  { module: "OWNER_ACCOUNTING", action: "DELETE", scope: "COMPANY" },
  { module: "OWNER_ACCOUNTING", action: "APPROVE", scope: "COMPANY" },
  { module: "OWNER_ACCOUNTING", action: "EXPORT", scope: "COMPANY" },
  { module: "OWNER_ACCOUNTING", action: "PRINT", scope: "COMPANY" },
  { module: "INVESTOR_ACCOUNTING", action: "VIEW", scope: "COMPANY" },
  { module: "INVESTOR_ACCOUNTING", action: "CREATE", scope: "COMPANY" },
  { module: "INVESTOR_ACCOUNTING", action: "UPDATE", scope: "COMPANY" },
  { module: "INVESTOR_ACCOUNTING", action: "DELETE", scope: "COMPANY" },
  { module: "INVESTOR_ACCOUNTING", action: "APPROVE", scope: "COMPANY" },
  { module: "INVESTOR_ACCOUNTING", action: "EXPORT", scope: "COMPANY" },
  { module: "INVESTOR_ACCOUNTING", action: "PRINT", scope: "COMPANY" },
  { module: "INVESTOR_ACCOUNTING", action: "COLLECT", scope: "COMPANY" },
  { module: "INVESTOR_ACCOUNTING", action: "PAY", scope: "COMPANY" },
  { module: "BANKS", action: "VIEW", scope: "COMPANY" },
  { module: "BANKS", action: "CREATE", scope: "COMPANY" },
  { module: "HR", action: "VIEW", scope: "COMPANY" },
  { module: "HR", action: "CREATE", scope: "COMPANY" },
  { module: "HR", action: "UPDATE", scope: "COMPANY" },
  { module: "HR", action: "DELETE", scope: "COMPANY" },
  { module: "HR", action: "EXPORT", scope: "COMPANY" },
  { module: "SALARIES", action: "VIEW", scope: "COMPANY" },
  { module: "SALARIES", action: "CREATE", scope: "COMPANY" },
  { module: "SALARIES", action: "UPDATE", scope: "COMPANY" },
  { module: "SALARIES", action: "APPROVE", scope: "COMPANY" },
  { module: "SALARIES", action: "EXPORT", scope: "COMPANY" },
  { module: "SALARIES", action: "PRINT", scope: "COMPANY" },
  { module: "DELIVERY_INVOICES", action: "APPROVE", scope: "COMPANY" },
  { module: "DELIVERY_HR", action: "VIEW", scope: "COMPANY" },
  { module: "DELIVERY_HR", action: "CREATE", scope: "COMPANY" },
  { module: "DELIVERY_HR", action: "UPDATE", scope: "COMPANY" },
  { module: "DELIVERY_HR", action: "DELETE", scope: "COMPANY" },
  { module: "DELIVERY_HR", action: "EXPORT", scope: "COMPANY" },
  { module: "DELIVERY_HR", action: "ASSIGN", scope: "COMPANY" },
  { module: "DELIVERY_HR", action: "RETURN", scope: "COMPANY" },
  { module: "DELIVERY_OPERATIONS", action: "VIEW", scope: "COMPANY" },
  { module: "DELIVERY_OPERATIONS", action: "CREATE", scope: "COMPANY" },
  { module: "DELIVERY_OPERATIONS", action: "UPDATE", scope: "COMPANY" },
  { module: "DELIVERY_OPERATIONS", action: "DELETE", scope: "COMPANY" },
  { module: "DELIVERY_OPERATIONS", action: "EXPORT", scope: "COMPANY" },
  { module: "DELIVERY_REPORTS", action: "VIEW", scope: "COMPANY" },
  { module: "DELIVERY_REPORTS", action: "EXPORT", scope: "COMPANY" },
  { module: "DELIVERY_REPORTS", action: "PRINT", scope: "COMPANY" },
  { module: "DELIVERY_EXPENSES", action: "VIEW", scope: "COMPANY" },
  { module: "DELIVERY_EXPENSES", action: "CREATE", scope: "COMPANY" },
  { module: "DELIVERY_EXPENSES", action: "UPDATE", scope: "COMPANY" },
  { module: "DELIVERY_EXPENSES", action: "DELETE", scope: "COMPANY" },
  { module: "DELIVERY_EXPENSES", action: "EXPORT", scope: "COMPANY" },
  { module: "CAR_WASH_HR", action: "VIEW", scope: "COMPANY" },
  { module: "CAR_WASH_HR", action: "CREATE", scope: "COMPANY" },
  { module: "CAR_WASH_HR", action: "UPDATE", scope: "COMPANY" },
  { module: "CAR_WASH_HR", action: "DELETE", scope: "COMPANY" },
  { module: "CAR_WASH_HR", action: "EXPORT", scope: "COMPANY" },
  { module: "CAR_WASH_HR", action: "ASSIGN", scope: "COMPANY" },
  { module: "CAR_WASH_HR", action: "RETURN", scope: "COMPANY" },
  { module: "CAR_WASH_OPERATIONS", action: "VIEW", scope: "COMPANY" },
  { module: "CAR_WASH_OPERATIONS", action: "CREATE", scope: "COMPANY" },
  { module: "CAR_WASH_OPERATIONS", action: "UPDATE", scope: "COMPANY" },
  { module: "CAR_WASH_OPERATIONS", action: "DELETE", scope: "COMPANY" },
  { module: "CAR_WASH_OPERATIONS", action: "EXPORT", scope: "COMPANY" },
  { module: "CAR_WASH_REPORTS", action: "VIEW", scope: "COMPANY" },
  { module: "CAR_WASH_REPORTS", action: "EXPORT", scope: "COMPANY" },
  { module: "CAR_WASH_REPORTS", action: "PRINT", scope: "COMPANY" },
  { module: "CAR_WASH_EXPENSES", action: "VIEW", scope: "COMPANY" },
  { module: "CAR_WASH_EXPENSES", action: "CREATE", scope: "COMPANY" },
  { module: "CAR_WASH_EXPENSES", action: "UPDATE", scope: "COMPANY" },
  { module: "CAR_WASH_EXPENSES", action: "DELETE", scope: "COMPANY" },
  { module: "CAR_WASH_EXPENSES", action: "EXPORT", scope: "COMPANY" },
  { module: "VEHICLES", action: "VIEW", scope: "COMPANY" },
  { module: "VEHICLES", action: "CREATE", scope: "COMPANY" },
  { module: "VEHICLES", action: "UPDATE", scope: "COMPANY" },
  { module: "VEHICLES", action: "DELETE", scope: "COMPANY" },
  { module: "VEHICLES", action: "EXPORT", scope: "COMPANY" },
  { module: "VEHICLES", action: "ASSIGN", scope: "COMPANY" },
  { module: "VEHICLES", action: "RETURN", scope: "COMPANY" },
  { module: "ASSETS_CUSTODY", action: "VIEW", scope: "COMPANY" },
  { module: "ASSETS_CUSTODY", action: "CREATE", scope: "COMPANY" },
  { module: "ASSETS_CUSTODY", action: "UPDATE", scope: "COMPANY" },
  { module: "ASSETS_CUSTODY", action: "DELETE", scope: "COMPANY" },
  { module: "ASSETS_CUSTODY", action: "EXPORT", scope: "COMPANY" },
  { module: "ASSETS_CUSTODY", action: "PRINT", scope: "COMPANY" },
  { module: "ASSETS_CUSTODY", action: "ASSIGN", scope: "COMPANY" },
  { module: "ASSETS_CUSTODY", action: "RETURN", scope: "COMPANY" },
  { module: "ATTACHMENTS", action: "VIEW", scope: "COMPANY" },
  { module: "ATTACHMENTS", action: "UPLOAD", scope: "COMPANY" },
  { module: "ATTACHMENTS", action: "DOWNLOAD", scope: "COMPANY" },
  { module: "ATTACHMENTS", action: "DELETE", scope: "COMPANY" },
  { module: "INVESTORS", action: "VIEW", scope: "COMPANY" },
  { module: "INVESTORS", action: "CREATE", scope: "COMPANY" },
  { module: "INVESTORS", action: "UPDATE", scope: "COMPANY" },
  { module: "INVESTORS", action: "DELETE", scope: "COMPANY" },
  { module: "INVESTORS", action: "EXPORT", scope: "COMPANY" },
  { module: "INVESTOR_CLAIMS", action: "VIEW", scope: "COMPANY" },
  { module: "INVESTOR_CLAIMS", action: "CREATE", scope: "COMPANY" },
  { module: "INVESTOR_CLAIMS", action: "UPDATE", scope: "COMPANY" },
  { module: "INVESTOR_CLAIMS", action: "DELETE", scope: "COMPANY" },
  { module: "INVESTOR_CLAIMS", action: "EXPORT", scope: "COMPANY" },
  { module: "INVESTOR_CLAIMS", action: "COLLECT", scope: "COMPANY" },
  { module: "INVESTOR_CLAIMS", action: "PAY", scope: "COMPANY" },
  { module: "INVESTOR_STATEMENTS", action: "VIEW", scope: "COMPANY" },
  { module: "INVESTOR_STATEMENTS", action: "EXPORT", scope: "COMPANY" },
  { module: "INVESTOR_STATEMENTS", action: "PRINT", scope: "COMPANY" },
  { module: "EXPENSES", action: "VIEW", scope: "COMPANY" },
  { module: "EXPENSES", action: "CREATE", scope: "COMPANY" },
  { module: "EXPENSES", action: "UPDATE", scope: "COMPANY" },
  { module: "EXPENSES", action: "DELETE", scope: "COMPANY" },
  { module: "EXPENSES", action: "EXPORT", scope: "COMPANY" },
  { module: "REPORTS", action: "VIEW", scope: "COMPANY" },
  { module: "REPORTS", action: "EXPORT", scope: "COMPANY" },
  { module: "REPORTS", action: "PRINT", scope: "COMPANY" },
  { module: "NOTIFICATIONS", action: "VIEW", scope: "COMPANY" },
  { module: "NOTIFICATIONS", action: "UPDATE", scope: "COMPANY" },
  { module: "NOTIFICATIONS", action: "RESOLVE", scope: "COMPANY" },
  { module: "TASKS", action: "VIEW", scope: "COMPANY" },
  { module: "TASKS", action: "CREATE", scope: "COMPANY" },
  { module: "TASKS", action: "UPDATE", scope: "COMPANY" },
  { module: "TASKS", action: "DELETE", scope: "COMPANY" },
  { module: "TASKS", action: "PRINT", scope: "COMPANY" },
  { module: "SETTINGS", action: "VIEW", scope: "GROUP" },
  { module: "SETTINGS", action: "CREATE", scope: "GROUP" },
  { module: "SETTINGS", action: "UPDATE", scope: "GROUP" },
  { module: "SETTINGS", action: "DELETE", scope: "GROUP" },
  { module: "USERS", action: "VIEW", scope: "GROUP" },
  { module: "USERS", action: "CREATE", scope: "GROUP" },
  { module: "USERS", action: "UPDATE", scope: "GROUP" },
  { module: "USERS", action: "DELETE", scope: "GROUP" },
  { module: "AUDIT_LOGS", action: "VIEW", scope: "GROUP" },
  { module: "AUDIT_LOGS", action: "EXPORT", scope: "GROUP" },
];

type GrantFlags = Pick<
  SessionCompanyAccess | SessionBranchAccess,
  "canView" | "canCreate" | "canUpdate" | "canDelete" | "canApprove"
>;

const ACTION_FLAG_MAP: Partial<Record<Action, keyof GrantFlags>> = {
  VIEW: "canView",
  CREATE: "canCreate",
  UPDATE: "canUpdate",
  DELETE: "canDelete",
  APPROVE: "canApprove",
  COLLECT: "canApprove",
  PAY: "canApprove",
  RESOLVE: "canUpdate",
};

const ROLE_PERMISSION_MATRIX: Record<string, Partial<Record<Module, Action[]>>> = {
  SUPER_ADMIN: {
    DASHBOARD: ["VIEW"],
    COMPANIES: ["VIEW", "CREATE", "UPDATE", "DELETE"],
    BRANCHES: ["VIEW", "CREATE", "UPDATE", "DELETE"],
    ADMINISTRATIVE_AFFAIRS: ["VIEW", "CREATE", "UPDATE", "DELETE", "EXPORT", "PRINT"],
    LICENSES: ["VIEW", "CREATE", "UPDATE", "DELETE", "EXPORT", "PRINT"],
    ACCOUNTING: ["VIEW", "CREATE", "UPDATE", "DELETE", "APPROVE", "EXPORT", "PRINT"],
    OWNER_ACCOUNTING: ["VIEW", "CREATE", "UPDATE", "DELETE", "APPROVE", "EXPORT", "PRINT"],
    INVESTOR_ACCOUNTING: ["VIEW", "CREATE", "UPDATE", "DELETE", "APPROVE", "EXPORT", "PRINT", "COLLECT", "PAY"],
    BANKS: ["VIEW", "CREATE", "UPDATE", "DELETE"],
    HR: ["VIEW", "CREATE", "UPDATE", "DELETE", "EXPORT"],
    SALARIES: ["VIEW", "CREATE", "UPDATE", "APPROVE", "EXPORT", "PRINT"],
    DELIVERY_HR: ["VIEW", "CREATE", "UPDATE", "DELETE", "EXPORT", "ASSIGN", "RETURN"],
    DELIVERY_OPERATIONS: ["VIEW", "CREATE", "UPDATE", "DELETE", "EXPORT"],
    DELIVERY_REPORTS: ["VIEW", "EXPORT", "PRINT"],
    DELIVERY_EXPENSES: ["VIEW", "CREATE", "UPDATE", "DELETE", "EXPORT"],
    CAR_WASH_HR: ["VIEW", "CREATE", "UPDATE", "DELETE", "EXPORT", "ASSIGN", "RETURN"],
    CAR_WASH_OPERATIONS: ["VIEW", "CREATE", "UPDATE", "DELETE", "EXPORT"],
    CAR_WASH_REPORTS: ["VIEW", "EXPORT", "PRINT"],
    CAR_WASH_EXPENSES: ["VIEW", "CREATE", "UPDATE", "DELETE", "EXPORT"],
    VEHICLES: ["VIEW", "CREATE", "UPDATE", "DELETE", "EXPORT", "ASSIGN", "RETURN"],
    ASSETS_CUSTODY: ["VIEW", "CREATE", "UPDATE", "DELETE", "EXPORT", "PRINT", "ASSIGN", "RETURN"],
    ATTACHMENTS: ["VIEW", "UPLOAD", "DOWNLOAD", "DELETE"],
    INVESTORS: ["VIEW", "CREATE", "UPDATE", "DELETE", "EXPORT"],
    INVESTOR_CLAIMS: ["VIEW", "CREATE", "UPDATE", "DELETE", "EXPORT", "COLLECT", "PAY"],
    INVESTOR_STATEMENTS: ["VIEW", "EXPORT", "PRINT"],
    EXPENSES: ["VIEW", "CREATE", "UPDATE", "DELETE", "EXPORT"],
    REPORTS: ["VIEW", "EXPORT", "PRINT"],
    NOTIFICATIONS: ["VIEW", "UPDATE", "RESOLVE"],
    TASKS: ["VIEW", "CREATE", "UPDATE", "DELETE", "PRINT"],
    SETTINGS: ["VIEW", "CREATE", "UPDATE", "DELETE"],
    USERS: ["VIEW", "CREATE", "UPDATE", "DELETE"],
    AUDIT_LOGS: ["VIEW", "EXPORT"],
  },
  GROUP_OWNER: {
    DASHBOARD: ["VIEW"],
    COMPANIES: ["VIEW", "UPDATE"],
    BRANCHES: ["VIEW", "CREATE", "UPDATE"],
    ADMINISTRATIVE_AFFAIRS: ["VIEW", "CREATE", "UPDATE", "EXPORT", "PRINT"],
    LICENSES: ["VIEW", "CREATE", "UPDATE", "EXPORT", "PRINT"],
    ACCOUNTING: ["VIEW", "CREATE", "UPDATE", "APPROVE", "EXPORT", "PRINT"],
    OWNER_ACCOUNTING: ["VIEW", "CREATE", "UPDATE", "APPROVE", "EXPORT", "PRINT"],
    INVESTOR_ACCOUNTING: ["VIEW", "CREATE", "UPDATE", "APPROVE", "EXPORT", "PRINT", "COLLECT", "PAY"],
    HR: ["VIEW", "CREATE", "UPDATE", "EXPORT"],
    SALARIES: ["VIEW", "CREATE", "UPDATE", "APPROVE", "EXPORT", "PRINT"],
    DELIVERY_HR: ["VIEW", "CREATE", "UPDATE", "EXPORT", "ASSIGN", "RETURN"],
    DELIVERY_OPERATIONS: ["VIEW", "CREATE", "UPDATE", "EXPORT"],
    DELIVERY_REPORTS: ["VIEW", "EXPORT", "PRINT"],
    DELIVERY_EXPENSES: ["VIEW", "CREATE", "UPDATE", "EXPORT"],
    CAR_WASH_HR: ["VIEW", "CREATE", "UPDATE", "EXPORT", "ASSIGN", "RETURN"],
    CAR_WASH_OPERATIONS: ["VIEW", "CREATE", "UPDATE", "EXPORT"],
    CAR_WASH_REPORTS: ["VIEW", "EXPORT", "PRINT"],
    CAR_WASH_EXPENSES: ["VIEW", "CREATE", "UPDATE", "EXPORT"],
    VEHICLES: ["VIEW", "CREATE", "UPDATE", "EXPORT", "ASSIGN", "RETURN"],
    ASSETS_CUSTODY: ["VIEW", "CREATE", "UPDATE", "EXPORT", "PRINT", "ASSIGN", "RETURN"],
    ATTACHMENTS: ["VIEW", "UPLOAD", "DOWNLOAD"],
    INVESTORS: ["VIEW", "CREATE", "UPDATE", "EXPORT"],
    INVESTOR_CLAIMS: ["VIEW", "CREATE", "UPDATE", "EXPORT", "COLLECT", "PAY"],
    INVESTOR_STATEMENTS: ["VIEW", "EXPORT", "PRINT"],
    EXPENSES: ["VIEW", "CREATE", "UPDATE", "EXPORT"],
    REPORTS: ["VIEW", "EXPORT", "PRINT"],
    NOTIFICATIONS: ["VIEW", "UPDATE", "RESOLVE"],
    TASKS: ["VIEW", "CREATE", "UPDATE", "PRINT"],
    USERS: ["VIEW", "CREATE", "UPDATE"],
    AUDIT_LOGS: ["VIEW"],
  },
  ACCOUNTANT: {
    DASHBOARD: ["VIEW"],
    ACCOUNTING: ["VIEW", "CREATE", "UPDATE", "APPROVE", "EXPORT", "PRINT"],
    OWNER_ACCOUNTING: ["VIEW", "CREATE", "UPDATE", "APPROVE", "EXPORT", "PRINT"],
    INVESTOR_ACCOUNTING: ["VIEW", "CREATE", "UPDATE", "APPROVE", "EXPORT", "PRINT", "COLLECT"],
    BANKS: ["VIEW"],
    SALARIES: ["VIEW", "CREATE", "UPDATE", "EXPORT", "PRINT"],
    INVESTOR_CLAIMS: ["VIEW", "UPDATE", "COLLECT", "PAY"],
    INVESTOR_STATEMENTS: ["VIEW", "EXPORT", "PRINT"],
    EXPENSES: ["VIEW", "CREATE", "UPDATE", "EXPORT"],
    REPORTS: ["VIEW", "EXPORT", "PRINT"],
    DELIVERY_REPORTS: ["VIEW", "EXPORT", "PRINT"],
    CAR_WASH_REPORTS: ["VIEW", "EXPORT", "PRINT"],
    ATTACHMENTS: ["VIEW", "DOWNLOAD"],
    NOTIFICATIONS: ["VIEW", "UPDATE", "RESOLVE"],
    TASKS: ["VIEW", "CREATE", "UPDATE", "PRINT"],
  },
  ADMINISTRATIVE_AFFAIRS: {
    DASHBOARD: ["VIEW"],
    ADMINISTRATIVE_AFFAIRS: ["VIEW", "CREATE", "UPDATE", "EXPORT", "PRINT"],
    LICENSES: ["VIEW", "CREATE", "UPDATE", "EXPORT", "PRINT"],
    HR: ["VIEW", "CREATE", "UPDATE"],
    VEHICLES: ["VIEW", "CREATE", "UPDATE"],
    INVESTORS: ["VIEW"],
    INVESTOR_CLAIMS: ["VIEW", "CREATE", "UPDATE", "PAY"],
    ATTACHMENTS: ["VIEW", "UPLOAD", "DOWNLOAD"],
    REPORTS: ["VIEW"],
    NOTIFICATIONS: ["VIEW", "UPDATE", "RESOLVE"],
    TASKS: ["VIEW", "CREATE", "UPDATE", "PRINT"],
  },
  DELIVERY_HR: {
    DASHBOARD: ["VIEW"],
    HR: ["VIEW", "CREATE", "UPDATE"],
    DELIVERY_HR: ["VIEW", "CREATE", "UPDATE", "EXPORT", "ASSIGN", "RETURN"],
    VEHICLES: ["VIEW", "ASSIGN"],
    ASSETS_CUSTODY: ["VIEW", "CREATE", "UPDATE", "EXPORT", "PRINT", "ASSIGN", "RETURN"],
    ATTACHMENTS: ["VIEW", "UPLOAD", "DOWNLOAD"],
    REPORTS: ["VIEW"],
    NOTIFICATIONS: ["VIEW", "UPDATE"],
    TASKS: ["VIEW", "CREATE", "UPDATE", "PRINT"],
  },
  DELIVERY_OPERATIONS: {
    DASHBOARD: ["VIEW"],
    DELIVERY_OPERATIONS: ["VIEW", "CREATE", "UPDATE", "EXPORT"],
    DELIVERY_REPORTS: ["VIEW", "EXPORT"],
    VEHICLES: ["VIEW"],
    ATTACHMENTS: ["VIEW", "DOWNLOAD"],
    NOTIFICATIONS: ["VIEW", "UPDATE"],
    TASKS: ["VIEW", "CREATE", "UPDATE", "PRINT"],
  },
  CAR_WASH_SUPERVISOR: {
    DASHBOARD: ["VIEW"],
    CAR_WASH_HR: ["VIEW", "CREATE", "UPDATE", "EXPORT", "ASSIGN", "RETURN"],
    CAR_WASH_OPERATIONS: ["VIEW", "CREATE", "UPDATE", "EXPORT"],
    CAR_WASH_REPORTS: ["VIEW", "EXPORT", "PRINT"],
    CAR_WASH_EXPENSES: ["VIEW", "CREATE", "UPDATE", "EXPORT"],
    VEHICLES: ["VIEW", "CREATE", "UPDATE", "ASSIGN", "RETURN"],
    ASSETS_CUSTODY: ["VIEW", "CREATE", "UPDATE", "EXPORT", "PRINT", "ASSIGN", "RETURN"],
    ATTACHMENTS: ["VIEW", "UPLOAD", "DOWNLOAD"],
    NOTIFICATIONS: ["VIEW", "UPDATE"],
    TASKS: ["VIEW", "CREATE", "UPDATE", "PRINT"],
  },
  HR_MANDOB: {
    DASHBOARD: ["VIEW"],
    ADMINISTRATIVE_AFFAIRS: ["VIEW", "CREATE", "UPDATE"],
    LICENSES: ["VIEW", "CREATE", "UPDATE"],
    HR: ["VIEW", "CREATE", "UPDATE", "EXPORT"],
    INVESTORS: ["VIEW", "CREATE", "UPDATE"],
    INVESTOR_CLAIMS: ["VIEW", "CREATE", "UPDATE"],
    ATTACHMENTS: ["VIEW", "UPLOAD", "DOWNLOAD"],
    NOTIFICATIONS: ["VIEW", "UPDATE"],
    TASKS: ["VIEW", "CREATE", "UPDATE", "PRINT"],
  },
  INVESTOR_VIEWER: {
    DASHBOARD: ["VIEW"],
    INVESTORS: ["VIEW"],
    INVESTOR_STATEMENTS: ["VIEW"],
    REPORTS: ["VIEW"],
    NOTIFICATIONS: ["VIEW"],
    TASKS: ["VIEW", "CREATE", "UPDATE", "PRINT"],
  },
  READ_ONLY: {
    DASHBOARD: ["VIEW"],
    REPORTS: ["VIEW"],
    ATTACHMENTS: ["VIEW", "DOWNLOAD"],
    NOTIFICATIONS: ["VIEW"],
    TASKS: ["VIEW", "CREATE", "UPDATE", "PRINT"],
  },
};

export function canAccessCompany(user: SessionUser, companyId: string): boolean {
  if (user.isSuperAdmin) return true;
  return user.companyAccess.includes(companyId);
}

export function canAccessBranch(user: SessionUser, branchId: string): boolean {
  if (user.isSuperAdmin) return true;
  return user.branchAccess.some((entry) => entry.branchId === branchId && entry.canView);
}

export function getAccessibleCompanyIds(user: SessionUser): string[] {
  if (user.isSuperAdmin) return [];
  return user.companyAccess;
}

export function getAccessibleBranchIds(user: SessionUser, companyId?: string): string[] {
  if (user.isSuperAdmin) return [];
  return user.branchAccess
    .filter((entry) => !companyId || entry.companyId === companyId)
    .map((entry) => entry.branchId);
}

export function hasPermission(
  user: SessionUser,
  module: Module,
  action: Action,
  options?: { companyId?: string; branchId?: string },
): boolean {
  if (user.isSuperAdmin) return true;

  if (options?.companyId && !canAccessCompany(user, options.companyId)) return false;
  if (options?.branchId && !canAccessBranch(user, options.branchId)) return false;

  const explicitDeny = user.permissions.some((permission) =>
    permission.allowed === false &&
    permission.module === module &&
    permission.action === action &&
    matchesScope(permission, options),
  );
  if (explicitDeny) return false;

  const explicit = user.permissions.some((permission) =>
    permission.allowed !== false &&
    permission.module === module &&
    permission.action === action &&
    matchesScope(permission, options),
  );
  if (explicit) return true;

  const scopedActionAllowed = hasScopedGrant(user, action, options);
  if (!scopedActionAllowed) return false;

  return user.roles.some((role) => {
    if (role.companyId && options?.companyId && role.companyId !== options.companyId) {
      return false;
    }
    const moduleActions = ROLE_PERMISSION_MATRIX[role.name]?.[module] ?? [];
    return moduleActions.includes(action);
  });
}

function matchesScope(
  permission: SessionPermission,
  options?: { companyId?: string; branchId?: string },
): boolean {
  switch (permission.scope) {
    case "GROUP":
      return true;
    case "COMPANY":
      return !options?.companyId || permission.companyId === options.companyId || !permission.companyId;
    case "BRANCH":
      return !options?.branchId || permission.branchId === options.branchId || !permission.branchId;
    case "OWN":
      return true;
    default:
      return false;
  }
}

function hasScopedGrant(
  user: SessionUser,
  action: Action,
  options?: { companyId?: string; branchId?: string },
): boolean {
  const flag = ACTION_FLAG_MAP[action];
  if (!flag) return true;

  if (options?.branchId) {
    const branchGrant = user.branchAccess.find((entry) => entry.branchId === options.branchId);
    if (branchGrant) return branchGrant[flag];
    // If branchId specified but no grant found, deny access
    return false;
  }

  if (options?.companyId) {
    const companyGrant = user.companyAccessEntries.find((entry) => entry.companyId === options.companyId);
    if (companyGrant) return companyGrant[flag];
    // If companyId specified but no grant found, deny access
    return false;
  }

  // Only check any company if no specific company/branch requested
  return user.companyAccessEntries.some((entry) => entry[flag]);
}

export function getVisibleModules(user: SessionUser, companyType?: string): Module[] {
  const modules = new Set<Module>();
  if (user.isSuperAdmin) {
    Object.keys(ROLE_PERMISSION_MATRIX.SUPER_ADMIN).forEach((moduleName) => {
      modules.add(moduleName as Module);
    });
  }

  user.roles.forEach((role) => {
    const roleModules = ROLE_PERMISSION_MATRIX[role.name] ?? {};
    Object.keys(roleModules).forEach((moduleName) => {
      modules.add(moduleName as Module);
    });
  });

  user.permissions.forEach((permission) => {
    modules.add(permission.module as Module);
  });

  return [...modules].filter((module) => companyTypeAllowsModule(companyType, module));
}

export function companyTypeAllowsModule(companyType: string | undefined, module: Module): boolean {
  if (!companyType) return true;

  const shared: Module[] = [
    "DASHBOARD",
    "ADMINISTRATIVE_AFFAIRS",
    "LICENSES",
    "ACCOUNTING",
    "OWNER_ACCOUNTING",
    "INVESTOR_ACCOUNTING",
    "ATTACHMENTS",
    "EXPENSES",
    "REPORTS",
    "ASSETS_CUSTODY",
    "VEHICLES",
    "NOTIFICATIONS",
    "TASKS",
    "INVESTOR_CLAIMS",
    "INVESTOR_STATEMENTS",
    "SALARIES",
  ];
  if (shared.includes(module)) return true;

  if (companyType === "DELIVERY") {
    return [
      "HR",
      "DELIVERY_HR",
      "DELIVERY_OPERATIONS",
      "DELIVERY_REPORTS",
      "DELIVERY_EXPENSES",
      "BANKS",
    ].includes(module);
  }

  if (companyType === "CAR_WASH") {
    return [
      "HR",
      "CAR_WASH_HR",
      "CAR_WASH_OPERATIONS",
      "CAR_WASH_REPORTS",
      "CAR_WASH_EXPENSES",
      "BANKS",
    ].includes(module);
  }

  if (companyType === "GENERAL_TRADING" || companyType === "TRADING") {
    return ["HR", "BRANCHES", "INVESTORS", "BANKS"].includes(module);
  }

  return ![
    "DELIVERY_HR",
    "DELIVERY_OPERATIONS",
    "DELIVERY_REPORTS",
    "DELIVERY_EXPENSES",
    "CAR_WASH_HR",
    "CAR_WASH_OPERATIONS",
    "CAR_WASH_REPORTS",
    "CAR_WASH_EXPENSES",
  ].includes(module);
}

export const SYSTEM_ROLES = [
  { name: "SUPER_ADMIN", nameAr: "مدير النظام الأعلى" },
  { name: "GROUP_OWNER", nameAr: "المالك / صاحب المجموعة" },
  { name: "ACCOUNTANT", nameAr: "محاسب" },
  { name: "ADMINISTRATIVE_AFFAIRS", nameAr: "موظف الشؤون الإدارية" },
  { name: "DELIVERY_HR", nameAr: "موظف موارد بشرية - التوصيل" },
  { name: "DELIVERY_OPERATIONS", nameAr: "مشرف / موظف عمليات" },
  { name: "CAR_WASH_SUPERVISOR", nameAr: "مشرف غسيل السيارات" },
  { name: "HR_MANDOB", nameAr: "موظف المعاملات / مندوب" },
  { name: "INVESTOR_VIEWER", nameAr: "مستخدم متابعة المسئولين والمديرين" },
  { name: "READ_ONLY", nameAr: "قراءة فقط" },
];
