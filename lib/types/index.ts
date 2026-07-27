import type {
  User, Role, Company, Branch, BankAccount, FiscalYear,
  ChartOfAccount, JournalEntry, JournalEntryLine, CostCenter,
  Employee, Driver, Vehicle, DeliveryContract, DeliveryMonthlyReport,
  CarWashVehicle, Investor, InvestorClaim, Expense, SalaryBatch, License, Notification, CompletedTask, UserPermission,
  CompanyType, AccountType, JournalEntryType, JournalStatus,
  EmployeeType, ClaimType, ClaimStatus, NormalBalance,
} from "@prisma/client";

export type {
  User, Role, Company, Branch, BankAccount, FiscalYear,
  ChartOfAccount, JournalEntry, JournalEntryLine, CostCenter,
  Employee, Driver, Vehicle, DeliveryContract, DeliveryMonthlyReport,
  CarWashVehicle, Investor, InvestorClaim, Expense, SalaryBatch, License, Notification, CompletedTask, UserPermission,
  CompanyType, AccountType, JournalEntryType, JournalStatus,
  EmployeeType, ClaimType, ClaimStatus, NormalBalance,
};

// ─── Auth ───────────────────────────────────────────────────
export interface SessionUser {
  id: string;
  email: string;
  nameAr: string;
  nameEn?: string | null;
  locale?: "ar" | "en";
  isSuperAdmin: boolean;
  employeeId?: string | null;
  accountType?: "ADMIN" | "DRIVER" | "CAR_WASH_WORKER" | "OWNER_MANAGED_PARTNER";
  roles: SessionRole[];
  groupAccess: SessionGroupAccess[];
  companyAccess: string[]; // company IDs
  companyAccessEntries: SessionCompanyAccess[];
  branchAccess: SessionBranchAccess[];
  permissions: SessionPermission[];
}

export interface SessionRole {
  name: string;
  companyId: string | null;
}

export interface SessionGroupAccess {
  groupId: string;
  canView: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canApprove: boolean;
}

export interface SessionCompanyAccess {
  companyId: string;
  roleId?: string | null;
  canView: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canApprove: boolean;
}

export interface SessionBranchAccess {
  branchId: string;
  companyId: string;
  canView: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canApprove: boolean;
}

export interface SessionPermission {
  permissionId?: string;
  module: string;
  action: string;
  scope: string;
  branchId?: string | null;
  companyId?: string | null;
  scopeKey?: string | null;
  allowed?: boolean;
}

export interface JwtPayload {
  sub: string; // user ID
  email: string;
  nameAr: string;
  nameEn?: string | null;
  locale?: "ar" | "en";
  isSuperAdmin: boolean;
  roles: SessionRole[];
  groupAccess: SessionGroupAccess[];
  companyAccess?: string[];
  companyAccessEntries: SessionCompanyAccess[];
  branchAccess: SessionBranchAccess[];
  permissions?: SessionPermission[];
  iat: number;
  exp: number;
}

// ─── API Response types ─────────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

// ─── Accounting ─────────────────────────────────────────────
export interface TrialBalanceRow {
  accountId: string;
  code: string;
  nameAr: string;
  nameEn?: string | null;
  type: AccountType;
  level: number;
  isHeader: boolean;
  openingDebit: number;
  openingCredit: number;
  periodDebit: number;
  periodCredit: number;
  closingDebit: number;
  closingCredit: number;
}

export interface IncomeStatementRow {
  section: string; // REVENUE | EXPENSE
  accountId: string;
  code: string;
  nameAr: string;
  amount: number;
  isHeader: boolean;
  level?: number;
}

export interface BalanceSheetRow {
  section: string; // ASSETS | LIABILITIES | EQUITY
  accountId: string;
  code: string;
  nameAr: string;
  amount: number;
  isHeader: boolean;
  level?: number;
}

export interface JournalEntryLineInput {
  accountId: string;
  descriptionAr?: string;
  debit: number;
  credit: number;
  costCenterId?: string;
  driverId?: string;
  employeeId?: string;
  investorId?: string;
  branchId?: string;
  carWashVehicleId?: string;
}

export interface CreateJournalEntryInput {
  companyId: string;
  date: Date;
  descriptionAr: string;
  descriptionEn?: string;
  type: JournalEntryType;
  reference?: string;
  refModule?: string;
  refId?: string;
  isAutomatic?: boolean;
  costCenterId?: string;
  lines: JournalEntryLineInput[];
  createdById: string;
  fiscalYearId?: string;
}

// ─── Delivery ───────────────────────────────────────────────
export interface DriverWithEmployee extends Driver {
  employee: Employee;
}

export interface MonthlyReportSummary {
  contractId: string;
  platform: string | null;
  month: number;
  year: number;
  totalDrivers: number;
  totalOrders: number;
  totalGross: number;
  totalWallet: number;
  totalNet: number;
}

// ─── Car Wash ────────────────────────────────────────────────
export interface VehicleProfitabilitySummary {
  vehicleId: string;
  vehicleCode: string;
  vehicleNameAr: string;
  month: number;
  year: number;
  totalCash: number;
  totalKnet: number;
  totalRevenue: number;
  totalExpenses: number;
  grossProfit: number;
  grossMargin: number;
}

// ─── Dashboard ───────────────────────────────────────────────
export interface DashboardMetric {
  label: string;
  value: number | string;
  change?: number;
  changeLabel?: string;
  color?: string;
  icon?: string;
}

export interface CompanyDashboard {
  companyId: string;
  metrics: DashboardMetric[];
  recentJournalEntries: JournalEntry[];
  pendingApprovals: number;
  expiryAlerts: ExpiryAlert[];
}

export interface ExpiryAlert {
  type: "RESIDENCY" | "LICENSE" | "INSURANCE" | "REGISTRATION";
  employeeId?: string;
  vehicleId?: string;
  nameAr: string;
  expiryDate: Date;
  daysRemaining: number;
}

// ─── Offline Sync ────────────────────────────────────────────
export interface SyncQueueItem {
  id: string;
  clientId: string;
  operation: "CREATE" | "UPDATE" | "DELETE";
  module: string;
  entityType: string;
  entityId?: string;
  payload: Record<string, unknown>;
  status: "PENDING" | "PROCESSING" | "SYNCED" | "FAILED" | "CONFLICT";
  retryCount: number;
  error?: string;
  clientTimestamp: Date;
}
