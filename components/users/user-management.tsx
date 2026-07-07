"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { Building2, CheckCircle, KeyRound, Shield, SlidersHorizontal, Trash2, UserCheck, UserX, Users, XCircle } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";

interface RoleOption {
  id: string;
  name: string;
  nameAr: string;
}

interface PermissionOption {
  id: string;
  module: string;
  action: string;
  scope: string;
}

interface BranchOption {
  id: string;
  nameAr: string;
  companyId: string;
}

interface CompanyOption {
  id: string;
  nameAr: string;
  type: string;
  branches: BranchOption[];
}

interface ExistingUser {
  id: string;
  email: string;
  nameAr: string;
  isActive: boolean;
  isSuperAdmin: boolean;
  roles: Array<{
    roleId: string;
    companyId: string | null;
    role: { nameAr: string };
    company: { nameAr: string } | null;
  }>;
  companyAccess: Array<{
    companyId: string;
    canView: boolean;
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
    canApprove: boolean;
    company: { nameAr: string };
  }>;
  branchAccess: Array<{
    branchId: string;
    companyId: string;
    canView: boolean;
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
    canApprove: boolean;
    branch: { nameAr: string };
  }>;
  directPermissions?: Array<{
    permissionId: string;
    companyId?: string | null;
    branchId?: string | null;
    scopeKey: string;
    isAllowed: boolean;
    permission: {
      id: string;
      module: string;
      action: string;
      scope: string;
    };
  }>;
}

interface Props {
  users: ExistingUser[];
  roles: RoleOption[];
  companies: CompanyOption[];
  permissions: PermissionOption[];
  canManagePasswords?: boolean;
  granularPermissionsEnabled?: boolean;
}

type AccessFlags = {
  canView: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canApprove: boolean;
};

type DirectPermissionDraft = {
  permissionId: string;
  module: string;
  action: string;
  scope: string;
  companyId: string | null;
  branchId: string | null;
  scopeKey: string;
  isAllowed: boolean;
};

const defaultFlags: AccessFlags = {
  canView: true,
  canCreate: false,
  canUpdate: false,
  canDelete: false,
  canApprove: false,
};

const MODULE_GROUPS: Record<string, string[]> = {
  "الإدارة والمستخدمون": ["DASHBOARD", "COMPANIES", "BRANCHES", "USERS", "SETTINGS", "AUDIT_LOGS", "NOTIFICATIONS"],
  "الموظفون والرواتب":    ["HR", "SALARIES", "ADMINISTRATIVE_AFFAIRS"],
  "المحاسبة والمالية":    ["ACCOUNTING", "OWNER_ACCOUNTING", "INVESTOR_ACCOUNTING", "BANKS", "EXPENSES"],
  "المسئولون والمديرون":  ["INVESTORS", "INVESTOR_CLAIMS", "INVESTOR_STATEMENTS"],
  "التوصيل":              ["DELIVERY_HR", "DELIVERY_OPERATIONS", "DELIVERY_REPORTS", "DELIVERY_EXPENSES"],
  "غسيل السيارات":        ["CAR_WASH_HR", "CAR_WASH_OPERATIONS", "CAR_WASH_REPORTS", "CAR_WASH_EXPENSES"],
  "الأصول والمركبات":     ["VEHICLES", "ASSETS_CUSTODY", "ATTACHMENTS", "LICENSES"],
  "تقارير ومهام":         ["REPORTS", "TASKS"],
};

const scopeLabelMap: Record<string, { ar: string; en: string }> = {
  GROUP: { ar: "على مستوى المجموعة", en: "Group scope" },
  COMPANY: { ar: "على مستوى الشركة", en: "Company scope" },
  BRANCH: { ar: "على مستوى الفرع", en: "Branch scope" },
  OWN: { ar: "على مستوى المستخدم نفسه", en: "Own scope" },
};

const moduleLabelMap: Record<string, { ar: string; en: string }> = {
  DASHBOARD: { ar: "لوحة التحكم", en: "Dashboard" },
  COMPANIES: { ar: "الشركات", en: "Companies" },
  BRANCHES: { ar: "الفروع", en: "Branches" },
  ADMINISTRATIVE_AFFAIRS: { ar: "الشؤون الإدارية", en: "Administrative Affairs" },
  LICENSES: { ar: "التراخيص", en: "Licenses" },
  ACCOUNTING: { ar: "المحاسبة", en: "Accounting" },
  OWNER_ACCOUNTING: { ar: "محاسبة شركات المالك", en: "Owner Accounting" },
  INVESTOR_ACCOUNTING: { ar: "محاسبة المستثمرين", en: "Investor Accounting" },
  BANKS: { ar: "الحسابات البنكية", en: "Bank Accounts" },
  HR: { ar: "الموظفون", en: "HR" },
  SALARIES: { ar: "الرواتب", en: "Salaries" },
  DELIVERY_HR: { ar: "موارد التوصيل", en: "Delivery HR" },
  DELIVERY_OPERATIONS: { ar: "عمليات التوصيل", en: "Delivery Operations" },
  DELIVERY_REPORTS: { ar: "تقارير التوصيل", en: "Delivery Reports" },
  DELIVERY_EXPENSES: { ar: "مصروفات التوصيل", en: "Delivery Expenses" },
  CAR_WASH_HR: { ar: "موارد غسيل السيارات", en: "Car Wash HR" },
  CAR_WASH_OPERATIONS: { ar: "عمليات غسيل السيارات", en: "Car Wash Operations" },
  CAR_WASH_REPORTS: { ar: "تقارير غسيل السيارات", en: "Car Wash Reports" },
  CAR_WASH_EXPENSES: { ar: "مصروفات غسيل السيارات", en: "Car Wash Expenses" },
  VEHICLES: { ar: "المركبات", en: "Vehicles" },
  ASSETS_CUSTODY: { ar: "العهد والأصول", en: "Assets Custody" },
  ATTACHMENTS: { ar: "المرفقات", en: "Attachments" },
  INVESTORS: { ar: "المستثمرون", en: "Investors" },
  INVESTOR_CLAIMS: { ar: "مطالبات المستثمرين", en: "Investor Claims" },
  INVESTOR_STATEMENTS: { ar: "كشوف المستثمرين", en: "Investor Statements" },
  EXPENSES: { ar: "المصروفات", en: "Expenses" },
  REPORTS: { ar: "التقارير", en: "Reports" },
  NOTIFICATIONS: { ar: "الإشعارات", en: "Notifications" },
  TASKS: { ar: "المهام المنجزة", en: "Completed Tasks" },
  SETTINGS: { ar: "الإعدادات", en: "Settings" },
  USERS: { ar: "المستخدمون", en: "Users" },
  AUDIT_LOGS: { ar: "سجل العمليات", en: "Audit Logs" },
};

const actionLabelMap: Record<string, { ar: string; en: string }> = {
  VIEW: { ar: "عرض", en: "View" },
  CREATE: { ar: "إنشاء", en: "Create" },
  UPDATE: { ar: "تعديل", en: "Update" },
  DELETE: { ar: "حذف", en: "Delete" },
  APPROVE: { ar: "اعتماد", en: "Approve" },
  EXPORT: { ar: "تصدير", en: "Export" },
  PRINT: { ar: "طباعة", en: "Print" },
  UPLOAD: { ar: "رفع", en: "Upload" },
  DOWNLOAD: { ar: "تنزيل", en: "Download" },
  ASSIGN: { ar: "تسليم", en: "Assign" },
  RETURN: { ar: "استرجاع", en: "Return" },
  COLLECT: { ar: "تحصيل", en: "Collect" },
  PAY: { ar: "دفع", en: "Pay" },
  RESOLVE: { ar: "معالجة", en: "Resolve" },
};

function permissionLabel(permission: PermissionOption, locale: "ar" | "en") {
  const scopeLabel = scopeLabelMap[permission.scope]?.[locale] ?? permission.scope;
  const moduleLabel = moduleLabelMap[permission.module]?.[locale] ?? permission.module;
  const actionLabel = actionLabelMap[permission.action]?.[locale] ?? permission.action;
  return `${moduleLabel} - ${actionLabel} - ${scopeLabel}`;
}

export function UserManagement({
  users,
  roles,
  companies,
  permissions,
  canManagePasswords = false,
  granularPermissionsEnabled = true,
}: Props) {
  const { locale, t } = useLocale();
  const [usersState, setUsersState] = useState<ExistingUser[]>(users);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activePasswordUserId, setActivePasswordUserId] = useState<string | null>(null);
  const [activePermissionsUserId, setActivePermissionsUserId] = useState<string | null>(null);
  const [activeAccessUserId, setActiveAccessUserId] = useState<string | null>(null);
  const [activeRolesUserId, setActiveRolesUserId] = useState<string | null>(null);
  const [passwordForm, setPasswordForm] = useState({ password: "", confirmPassword: "" });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [permissionLoading, setPermissionLoading] = useState(false);
  const [roleLoading, setRoleLoading] = useState(false);
  const [editingRoles, setEditingRoles] = useState<Array<{ roleId: string; companyId: string | null }>>([]);
  const [selectedModule, setSelectedModule] = useState("");
  const [selectedActions, setSelectedActions] = useState<string[]>([]);
  const [selectedPermissionCompanyIds, setSelectedPermissionCompanyIds] = useState<string[]>([]);
  const [selectedPermissionBranchIds, setSelectedPermissionBranchIds] = useState<string[]>([]);
  const [selectedPermissionAllowed, setSelectedPermissionAllowed] = useState(true);
  const [editingPermissions, setEditingPermissions] = useState<DirectPermissionDraft[]>([]);
  const [form, setForm] = useState({
    nameAr: "",
    nameEn: "",
    email: "",
    phone: "",
    password: "",
    isActive: true,
    isSuperAdmin: false,
  });
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedCompanies, setSelectedCompanies] = useState<Record<string, AccessFlags>>({});
  const [selectedBranches, setSelectedBranches] = useState<Record<string, AccessFlags & { companyId: string }>>({});

  const selectedCompanyIds = useMemo(() => Object.keys(selectedCompanies), [selectedCompanies]);
  const selectedScope = useMemo(() => {
    if (!selectedModule || selectedActions.length === 0) return null;
    return permissions.find((p) => p.module === selectedModule && p.action === selectedActions[0])?.scope ?? null;
  }, [selectedModule, selectedActions, permissions]);

  const availableModules = useMemo(() => {
    const existing = new Set(permissions.map((p) => p.module));
    return Object.entries(MODULE_GROUPS).map(([group, mods]) => ({
      group,
      modules: mods.filter((m) => existing.has(m)),
    })).filter((g) => g.modules.length > 0);
  }, [permissions]);

  const availableActions = useMemo(() => {
    if (!selectedModule) return [];
    const seen = new Set<string>();
    return permissions
      .filter((p) => p.module === selectedModule)
      .map((p) => p.action)
      .filter((a) => { if (seen.has(a)) return false; seen.add(a); return true; });
  }, [permissions, selectedModule]);


  const text = (ar: string, en: string) => (locale === "en" ? en : ar);

  function updateField<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function toggleRole(roleId: string) {
    setSelectedRoles((prev) => (prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]));
  }

  function toggleCompany(companyId: string) {
    setSelectedCompanies((prev) => {
      if (prev[companyId]) {
        const next = { ...prev };
        delete next[companyId];
        setSelectedBranches((branchPrev) =>
          Object.fromEntries(Object.entries(branchPrev).filter(([, value]) => value.companyId !== companyId)),
        );
        return next;
      }
      return { ...prev, [companyId]: { ...defaultFlags } };
    });
  }

  function toggleBranch(branchId: string, companyId: string) {
    setSelectedBranches((prev) => {
      if (prev[branchId]) {
        const next = { ...prev };
        delete next[branchId];
        return next;
      }
      return { ...prev, [branchId]: { companyId, ...defaultFlags } };
    });
  }

  function updateCompanyFlag(companyId: string, field: keyof AccessFlags, checked: boolean) {
    setSelectedCompanies((prev) => ({
      ...prev,
      [companyId]: { ...prev[companyId], [field]: checked },
    }));
  }

  function updateBranchFlag(branchId: string, field: keyof AccessFlags, checked: boolean) {
    setSelectedBranches((prev) => ({
      ...prev,
      [branchId]: { ...prev[branchId], [field]: checked },
    }));
  }

  function buildScopeKey(permission: PermissionOption, companyId?: string, branchId?: string) {
    if (permission.scope === "GROUP") return "GROUP";
    if (permission.scope === "COMPANY") return `COMPANY:${companyId ?? "ALL"}`;
    if (permission.scope === "BRANCH") return `BRANCH:${branchId ?? "ALL"}`;
    return "OWN";
  }

  function resetPermissionPicker() {
    setSelectedModule("");
    setSelectedActions([]);
    setSelectedPermissionCompanyIds([]);
    setSelectedPermissionBranchIds([]);
    setSelectedPermissionAllowed(true);
  }

  function openPermissionEditor(user: ExistingUser) {
    setActivePermissionsUserId(user.id);
    setEditingPermissions(
      (user.directPermissions ?? []).map((entry) => ({
        permissionId: entry.permissionId,
        module: entry.permission.module,
        action: entry.permission.action,
        scope: entry.permission.scope,
        companyId: entry.companyId ?? null,
        branchId: entry.branchId ?? null,
        scopeKey: entry.scopeKey,
        isAllowed: entry.isAllowed,
      })),
    );
    resetPermissionPicker();
    setError("");
    setSuccess("");
  }

  function addDirectPermission() {
    if (!selectedModule || selectedActions.length === 0) {
      setError(text("اختر القسم وإجراءً على الأقل", "Select a module and at least one action"));
      return;
    }
    if (selectedScope === "COMPANY" && selectedPermissionCompanyIds.length === 0) {
      setError(text("حدد شركة واحدة على الأقل", "Select at least one company"));
      return;
    }
    if (selectedScope === "BRANCH" && selectedPermissionBranchIds.length === 0) {
      setError(text("حدد فرعًا واحدًا على الأقل", "Select at least one branch"));
      return;
    }

    const drafts: DirectPermissionDraft[] = [];

    for (const action of selectedActions) {
      const permission = permissions.find((p) => p.module === selectedModule && p.action === action);
      if (!permission) continue;

      if (permission.scope === "GROUP" || permission.scope === "OWN") {
        drafts.push({
          permissionId: permission.id,
          module: permission.module,
          action: permission.action,
          scope: permission.scope,
          companyId: null,
          branchId: null,
          scopeKey: buildScopeKey(permission),
          isAllowed: selectedPermissionAllowed,
        });
      } else if (permission.scope === "COMPANY") {
        for (const companyId of selectedPermissionCompanyIds) {
          drafts.push({
            permissionId: permission.id,
            module: permission.module,
            action: permission.action,
            scope: permission.scope,
            companyId,
            branchId: null,
            scopeKey: buildScopeKey(permission, companyId),
            isAllowed: selectedPermissionAllowed,
          });
        }
      } else if (permission.scope === "BRANCH") {
        for (const branchId of selectedPermissionBranchIds) {
          const ownerCompany = companies.find((c) => c.branches.some((b) => b.id === branchId));
          const companyId = ownerCompany?.id ?? null;
          drafts.push({
            permissionId: permission.id,
            module: permission.module,
            action: permission.action,
            scope: permission.scope,
            companyId,
            branchId,
            scopeKey: buildScopeKey(permission, companyId ?? undefined, branchId),
            isAllowed: selectedPermissionAllowed,
          });
        }
      }
    }

    if (drafts.length === 0) {
      setError(text("لم يتم العثور على صلاحيات مطابقة", "No matching permissions found"));
      return;
    }

    setEditingPermissions((prev) => {
      let next = [...prev];
      for (const draft of drafts) {
        next = next.filter((entry) => !(entry.permissionId === draft.permissionId && entry.scopeKey === draft.scopeKey));
        next.push(draft);
      }
      return next;
    });
    resetPermissionPicker();
    setError("");
  }

  function removeDirectPermission(permissionId: string, scopeKey: string) {
    setEditingPermissions((prev) => prev.filter((entry) => !(entry.permissionId === permissionId && entry.scopeKey === scopeKey)));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const payload = {
        ...form,
        roleIds: selectedRoles,
        groupIds: [],
        companyAccess: Object.entries(selectedCompanies).map(([companyId, flags]) => ({
          companyId,
          ...flags,
        })),
        branchAccess: Object.entries(selectedBranches).map(([branchId, value]) => ({
          branchId,
          companyId: value.companyId,
          canView: value.canView,
          canCreate: value.canCreate,
          canUpdate: value.canUpdate,
          canDelete: value.canDelete,
          canApprove: value.canApprove,
        })),
        directPermissions: [],
      };

      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error ?? text("فشل في إنشاء المستخدم", "Failed to create user"));
      }

      setSuccess(text("تم إنشاء المستخدم بنجاح. حدّث الصفحة لمراجعة القائمة.", "User created successfully. Refresh the page to review the list."));
      setForm({
        nameAr: "",
        nameEn: "",
        email: "",
        phone: "",
        password: "",
        isActive: true,
        isSuperAdmin: false,
      });
      setSelectedRoles([]);
      setSelectedCompanies({});
      setSelectedBranches({});
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : text("فشل في إنشاء المستخدم", "Failed to create user"));
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordReset(userId: string) {
    if (passwordForm.password.length < 8) {
      setError(t("usersManagement.passwordMin"));
      return;
    }
    if (passwordForm.password !== passwordForm.confirmPassword) {
      setError(t("usersManagement.passwordMismatch"));
      return;
    }

    setPasswordLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/users/${userId}/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: passwordForm.password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? t("usersManagement.passwordRestricted"));

      setSuccess(t("usersManagement.passwordUpdated"));
      setActivePasswordUserId(null);
      setPasswordForm({ password: "", confirmPassword: "" });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t("usersManagement.passwordRestricted"));
    } finally {
      setPasswordLoading(false);
    }
  }

  async function handleDirectPermissionsSave(userId: string) {
    setPermissionLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/users/${userId}/permissions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: editingPermissions }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error ?? text("تعذر تحديث الصلاحيات", "Failed to update permissions"));
      }

      setSuccess(text("تم تحديث الصلاحيات المباشرة بنجاح. حدّث الصفحة لمراجعة البيانات المحدثة.", "Direct permissions updated successfully. Refresh the page to review updated data."));
      setActivePermissionsUserId(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : text("تعذر تحديث الصلاحيات", "Failed to update permissions"));
    } finally {
      setPermissionLoading(false);
    }
  }

  async function handleRolesSave(userId: string) {
    setRoleLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/users/${userId}/roles`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roles: editingRoles }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error ?? text("تعذر تحديث الأدوار", "Failed to update roles"));
      }

      setSuccess(text("تم تحديث الأدوار بنجاح. حدّث الصفحة لمراجعة البيانات المحدثة.", "Roles updated successfully. Refresh the page to review updated data."));
      setActiveRolesUserId(null);
      setEditingRoles([]);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : text("تعذر تحديث الأدوار", "Failed to update roles"));
    } finally {
      setRoleLoading(false);
    }
  }

  async function handleToggleUserStatus(userId: string, nextIsActive: boolean) {
    const confirmationMessage = nextIsActive
      ? text("هل تريد إعادة تفعيل هذا المستخدم؟", "Do you want to reactivate this user?")
      : text("هل تريد تعطيل هذا المستخدم؟", "Do you want to disable this user?");
    if (!window.confirm(confirmationMessage)) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: nextIsActive }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error ?? text("تعذر تحديث حالة المستخدم", "Failed to update user status"));
      }

      setUsersState((prev) =>
        prev.map((user) => (user.id === userId ? { ...user, isActive: nextIsActive } : user)),
      );
      setSuccess(
        nextIsActive
          ? text("تمت إعادة تفعيل المستخدم بنجاح", "User reactivated successfully")
          : text("تم تعطيل المستخدم بنجاح", "User disabled successfully"),
      );
    } catch (statusError) {
      setError(
        statusError instanceof Error
          ? statusError.message
          : text("تعذر تحديث حالة المستخدم", "Failed to update user status"),
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteUser(userId: string) {
    if (!window.confirm(text("هل تريد حذف هذا المستخدم نهائيًا؟", "Do you want to permanently delete this user?"))) {
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/users/${userId}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error ?? text("تعذر حذف المستخدم", "Failed to delete user"));
      }

      setUsersState((prev) => prev.filter((user) => user.id !== userId));
      setSuccess(text("تم حذف المستخدم بنجاح", "User deleted successfully"));
      if (activePasswordUserId === userId) setActivePasswordUserId(null);
      if (activePermissionsUserId === userId) setActivePermissionsUserId(null);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : text("تعذر حذف المستخدم", "Failed to delete user"),
      );
    } finally {
      setLoading(false);
    }
  }

  function describeDirectPermission(entry: DirectPermissionDraft) {
    const permission =
      permissions.find((item) => item.id === entry.permissionId) ??
      permissions.find(
        (item) =>
          item.module === entry.module &&
          item.action === entry.action &&
          item.scope === entry.scope,
      );
    const company = companies.find((item) => item.id === entry.companyId);
    const branch = company?.branches.find((item) => item.id === entry.branchId);
    if (!permission) return entry.scopeKey;

    const parts = [permissionLabel(permission, locale)];
    if (company) parts.push(company.nameAr);
    if (branch) parts.push(branch.nameAr);
    parts.push(entry.isAllowed ? text("سماح", "Allow") : text("منع", "Deny"));
    return parts.join(" • ");
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard icon={<Users size={20} className="text-blue-600" />} iconBg="bg-blue-50" value={usersState.length} label={text("إجمالي المستخدمين", "Total users")} />
        <StatCard icon={<CheckCircle size={20} className="text-green-600" />} iconBg="bg-green-50" value={usersState.filter((user) => user.isActive).length} label={text("مستخدم نشط", "Active users")} />
        <StatCard icon={<Shield size={20} className="text-purple-600" />} iconBg="bg-purple-50" value={usersState.filter((user) => user.isSuperAdmin).length} label={text("مدير نظام", "System admins")} />
      </div>

      <form onSubmit={handleSubmit} className="section-card space-y-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-bold">{text("إنشاء مستخدم جديد", "Create New User")}</h2>
            <p className="text-sm text-muted-foreground">{text("حدد الدور وصلاحيات الشركات والفروع لهذا المستخدم.", "Assign roles and company/branch access for this user.")}</p>
          </div>
          <div className="text-xs text-muted-foreground">
            {selectedRoles.length} {text("دور", "role")} • {selectedCompanyIds.length} {text("شركة", "company")} • {Object.keys(selectedBranches).length} {text("فرع", "branch")}
          </div>
        </div>

        {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
        {success ? <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div> : null}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label={text("الاسم بالعربية", "Arabic Name")} required>
            <input className="input-field w-full" value={form.nameAr} onChange={(event) => updateField("nameAr", event.target.value)} required />
          </Field>
          <Field label={text("الاسم بالإنجليزية", "English Name")}>
            <input className="input-field w-full" value={form.nameEn} onChange={(event) => updateField("nameEn", event.target.value)} dir="ltr" />
          </Field>
          <Field label={text("البريد الإلكتروني", "Email")} required>
            <input type="email" className="input-field w-full" value={form.email} onChange={(event) => updateField("email", event.target.value)} dir="ltr" required />
          </Field>
          <Field label={text("الهاتف", "Phone")}>
            <input className="input-field w-full" value={form.phone} onChange={(event) => updateField("phone", event.target.value)} dir="ltr" />
          </Field>
          <Field label={text("كلمة المرور", "Password")} required>
            <input type="password" className="input-field w-full" value={form.password} onChange={(event) => updateField("password", event.target.value)} required />
          </Field>
          <div className="flex items-end gap-5">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isActive} onChange={(event) => updateField("isActive", event.target.checked)} />
              <span>{text("نشط", "Active")}</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isSuperAdmin} onChange={(event) => updateField("isSuperAdmin", event.target.checked)} />
              <span>Super Admin</span>
            </label>
          </div>
        </div>

        <div>
          <h3 className="mb-3 font-medium">{text("الأدوار", "Roles")}</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {roles.map((role) => (
              <label key={role.id} className="flex items-center gap-3 rounded-lg border px-3 py-3 hover:bg-muted/30">
                <input type="checkbox" checked={selectedRoles.includes(role.id)} onChange={() => toggleRole(role.id)} />
                <div>
                  <p className="text-sm font-medium">{role.nameAr}</p>
                  <p className="text-xs text-muted-foreground">{role.name}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-3 font-medium">{text("صلاحيات الشركات والفروع", "Companies and Branches Access")}</h3>
          <div className="space-y-4">
            {companies.map((company) => {
              const isSelected = Boolean(selectedCompanies[company.id]);
              return (
                <div key={company.id} className="space-y-4 rounded-xl border p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <label className="flex items-center gap-3">
                      <input type="checkbox" checked={isSelected} onChange={() => toggleCompany(company.id)} />
                      <div>
                        <p className="font-medium">{company.nameAr}</p>
                        <p className="text-xs text-muted-foreground">{company.type}</p>
                      </div>
                    </label>
                    {isSelected ? <AccessFlagEditor value={selectedCompanies[company.id]} onChange={(field, checked) => updateCompanyFlag(company.id, field, checked)} /> : null}
                  </div>

                  {isSelected && company.branches.length > 0 ? (
                    <div className="border-t pt-4">
                      <p className="mb-2 text-sm font-medium">{text("الفروع المسموح بها", "Allowed Branches")}</p>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {company.branches.map((branch) => {
                          const branchEntry = selectedBranches[branch.id];
                          return (
                            <div key={branch.id} className="space-y-3 rounded-lg border p-3">
                              <label className="flex items-center gap-2 text-sm">
                                <input type="checkbox" checked={Boolean(branchEntry)} onChange={() => toggleBranch(branch.id, company.id)} />
                                <span>{branch.nameAr}</span>
                              </label>
                              {branchEntry ? <AccessFlagEditor value={branchEntry} onChange={(field, checked) => updateBranchFlag(branch.id, field, checked)} /> : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <button type="submit" disabled={loading} className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {loading ? text("جارٍ الإنشاء...", "Creating...") : text("إنشاء المستخدم", "Create User")}
        </button>
      </form>

      <div className="section-card overflow-hidden">
        <h2 className="mb-4 text-base font-bold">{text("المستخدمون الحاليون", "Current Users")}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">{text("الاسم", "Name")}</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">{text("البريد", "Email")}</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">{text("الأدوار", "Roles")}</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">{text("الشركات", "Companies")}</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">{text("الفروع", "Branches")}</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">{text("الحالة", "Status")}</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">{text("الصلاحيات المباشرة", "Direct Permissions")}</th>
                {canManagePasswords ? <th className="px-4 py-3 text-right font-medium text-muted-foreground">{text("الإجراءات", "Actions")}</th> : null}
              </tr>
            </thead>
            <tbody>
              {usersState.map((user) => {
                const isPasswordOpen = activePasswordUserId === user.id;
                const isPermissionsOpen = activePermissionsUserId === user.id;
                const isAccessOpen = activeAccessUserId === user.id;
                const isRolesOpen = activeRolesUserId === user.id;
                return (
                  <Fragment key={user.id}>
                    <tr className="align-top transition-colors hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium">{user.nameAr}</p>
                          {user.isSuperAdmin ? <p className="text-xs text-purple-600">Super Admin</p> : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground" dir="ltr">{user.email}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {user.roles.map((entry) => (
                            <span key={entry.roleId + (entry.companyId ?? "")} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                              {entry.role.nameAr}
                              {entry.company ? ` - ${entry.company.nameAr}` : ""}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {user.isSuperAdmin ? (
                            <span className="text-xs text-muted-foreground">{text("جميع الشركات", "All companies")}</span>
                          ) : (
                            user.companyAccess.map((entry) => (
                              <span key={entry.companyId} className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                                {entry.company.nameAr}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {user.branchAccess.length === 0 ? (
                            <span className="text-xs text-muted-foreground">{text("كل الفروع ضمن الشركات المصرح بها", "All branches within allowed companies")}</span>
                          ) : (
                            user.branchAccess.map((entry) => (
                              <span key={entry.branchId} className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                                {entry.branch.nameAr}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {user.isActive ? (
                          <span className="flex items-center gap-1 text-xs text-green-600">
                            <CheckCircle size={12} /> {text("نشط", "Active")}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-red-500">
                            <XCircle size={12} /> {text("موقوف", "Inactive")}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground">
                            {(user.directPermissions?.length ?? 0) > 0
                              ? text(`${user.directPermissions?.length ?? 0} صلاحية مباشرة`, `${user.directPermissions?.length ?? 0} direct permission(s)`)
                              : text("لا توجد صلاحيات مباشرة", "No direct permissions")}
                          </p>
                          {granularPermissionsEnabled ? (
                            <button type="button" onClick={() => openPermissionEditor(user)} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs hover:bg-muted">
                              <SlidersHorizontal size={14} />
                              {text("إدارة الصلاحيات", "Manage permissions")}
                            </button>
                          ) : (
                            <span className="inline-flex rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                              {text("الصلاحيات الدقيقة غير مفعلة على الخادم بعد", "Granular permissions are not enabled on the server yet")}
                            </span>
                          )}
                          {!user.isSuperAdmin ? (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  const isRolesOpen = activeRolesUserId === user.id;
                                  setActiveRolesUserId(isRolesOpen ? null : user.id);
                                  if (!isRolesOpen) {
                                    setEditingRoles(user.roles.map((r) => ({ roleId: r.roleId, companyId: r.companyId })));
                                  }
                                }}
                                className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs hover:bg-muted"
                              >
                                <Shield size={14} />
                                {text("تعديل الأدوار", "Edit roles")}
                              </button>
                              <button
                                type="button"
                                onClick={() => setActiveAccessUserId(isAccessOpen ? null : user.id)}
                                className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs hover:bg-muted"
                              >
                                <Building2 size={14} />
                                {text("تعديل الشركات والفروع", "Edit companies & branches")}
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                      {canManagePasswords ? (
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setActivePasswordUserId(isPasswordOpen ? null : user.id);
                                setPasswordForm({ password: "", confirmPassword: "" });
                              }}
                              className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs hover:bg-muted"
                            >
                              <KeyRound size={14} />
                              {t("usersManagement.resetPassword")}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleUserStatus(user.id, !user.isActive)}
                              disabled={loading}
                              className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs hover:bg-muted disabled:opacity-50"
                            >
                              {user.isActive ? <UserX size={14} /> : <UserCheck size={14} />}
                              {user.isActive ? text("تعطيل", "Disable") : text("تفعيل", "Activate")}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(user.id)}
                              disabled={loading}
                              className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                            >
                              <Trash2 size={14} />
                              {text("حذف", "Delete")}
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>

                    {granularPermissionsEnabled && isPermissionsOpen ? (
                      <tr className="border-b border-border/50 bg-muted/20">
                        <td colSpan={canManagePasswords ? 8 : 7} className="px-4 py-4">
                          <div className="space-y-4">
                            <div>
                              <h3 className="font-medium">{text("محرر الصلاحيات الدقيقة", "Granular Permissions Editor")}</h3>
                              <p className="text-sm text-muted-foreground">{text("أضف صلاحيات مباشرة تسمح أو تمنع إجراءات محددة لهذا المستخدم فوق صلاحيات الدور.", "Add direct allow or deny permissions for this user on top of role permissions.")}</p>
                            </div>

                            <div className="space-y-3">
                              {/* ── الخطوة 1: القسم ── */}
                              <Field label={text("القسم", "Module")}>
                                <select
                                  className="input-field w-full"
                                  value={selectedModule}
                                  onChange={(e) => { setSelectedModule(e.target.value); setSelectedActions([]); setSelectedPermissionCompanyIds([]); setSelectedPermissionBranchIds([]); }}
                                >
                                  <option value="">{text("اختر القسم", "Select module")}</option>
                                  {availableModules.map(({ group, modules }) => (
                                    <optgroup key={group} label={group}>
                                      {modules.map((mod) => (
                                        <option key={mod} value={mod}>
                                          {moduleLabelMap[mod]?.[locale] ?? mod}
                                        </option>
                                      ))}
                                    </optgroup>
                                  ))}
                                </select>
                              </Field>

                              {/* ── الخطوة 2: الإجراءات (متعددة) ── */}
                              {selectedModule && availableActions.length > 0 && (
                                <div>
                                  <div className="mb-1.5 flex items-center justify-between">
                                    <span className="text-sm font-medium">{text("الإجراءات", "Actions")}</span>
                                    <button
                                      type="button"
                                      className="text-xs text-primary hover:underline"
                                      onClick={() => setSelectedActions(selectedActions.length === availableActions.length ? [] : [...availableActions])}
                                    >
                                      {selectedActions.length === availableActions.length ? text("إلغاء الكل", "Deselect all") : text("تحديد الكل", "Select all")}
                                    </button>
                                  </div>
                                  <div className="flex flex-wrap gap-3 rounded-lg border p-2">
                                    {availableActions.map((action) => (
                                      <label key={action} className="flex cursor-pointer items-center gap-1.5 text-sm">
                                        <input
                                          type="checkbox"
                                          checked={selectedActions.includes(action)}
                                          onChange={() => setSelectedActions((prev) => prev.includes(action) ? prev.filter((a) => a !== action) : [...prev, action])}
                                        />
                                        {actionLabelMap[action]?.[locale] ?? action}
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* ── الشركات (تظهر لو نطاق الصلاحية = شركة) ── */}
                              {selectedScope === "COMPANY" && (
                                <div>
                                  <div className="mb-1.5 flex items-center justify-between">
                                    <span className="text-sm font-medium">{text("الشركات", "Companies")}</span>
                                    <button
                                      type="button"
                                      className="text-xs text-primary hover:underline"
                                      onClick={() => setSelectedPermissionCompanyIds(selectedPermissionCompanyIds.length === companies.length ? [] : companies.map((c) => c.id))}
                                    >
                                      {selectedPermissionCompanyIds.length === companies.length ? text("إلغاء الكل", "Deselect all") : text("تحديد الكل", "Select all")}
                                    </button>
                                  </div>
                                  <div className="flex flex-wrap gap-3 rounded-lg border p-2">
                                    {companies.map((company) => (
                                      <label key={company.id} className="flex cursor-pointer items-center gap-1.5 text-sm">
                                        <input
                                          type="checkbox"
                                          checked={selectedPermissionCompanyIds.includes(company.id)}
                                          onChange={() => setSelectedPermissionCompanyIds((prev) => prev.includes(company.id) ? prev.filter((id) => id !== company.id) : [...prev, company.id])}
                                        />
                                        {company.nameAr}
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* ── الفروع (تظهر لو نطاق الصلاحية = فرع) ── */}
                              {selectedScope === "BRANCH" && (
                                <div>
                                  <div className="mb-1.5 flex items-center justify-between">
                                    <span className="text-sm font-medium">{text("الفروع", "Branches")}</span>
                                    <button
                                      type="button"
                                      className="text-xs text-primary hover:underline"
                                      onClick={() => {
                                        const allBranchIds = companies.flatMap((c) => c.branches.map((b) => b.id));
                                        setSelectedPermissionBranchIds(selectedPermissionBranchIds.length === allBranchIds.length ? [] : allBranchIds);
                                      }}
                                    >
                                      {selectedPermissionBranchIds.length === companies.flatMap((c) => c.branches).length ? text("إلغاء الكل", "Deselect all") : text("تحديد الكل", "Select all")}
                                    </button>
                                  </div>
                                  <div className="space-y-2 rounded-lg border p-2">
                                    {companies.map((company) =>
                                      company.branches.length === 0 ? null : (
                                        <div key={company.id}>
                                          <p className="mb-1 text-xs font-medium text-muted-foreground">{company.nameAr}</p>
                                          <div className="flex flex-wrap gap-3">
                                            {company.branches.map((branch) => (
                                              <label key={branch.id} className="flex cursor-pointer items-center gap-1.5 text-sm">
                                                <input
                                                  type="checkbox"
                                                  checked={selectedPermissionBranchIds.includes(branch.id)}
                                                  onChange={() => setSelectedPermissionBranchIds((prev) => prev.includes(branch.id) ? prev.filter((id) => id !== branch.id) : [...prev, branch.id])}
                                                />
                                                {branch.nameAr}
                                              </label>
                                            ))}
                                          </div>
                                        </div>
                                      )
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* ── السماح / المنع ── */}
                            <div className="flex items-center gap-4">
                              <span className="text-sm font-medium">{text("نوع القرار:", "Rule:")}</span>
                              <label className="flex cursor-pointer items-center gap-2">
                                <input type="radio" name="permAllowed" value="ALLOW" checked={selectedPermissionAllowed} onChange={() => setSelectedPermissionAllowed(true)} className="accent-primary" />
                                <span className="text-sm font-medium text-green-700">{text("سماح", "Allow")}</span>
                              </label>
                              <label className="flex cursor-pointer items-center gap-2">
                                <input type="radio" name="permAllowed" value="DENY" checked={!selectedPermissionAllowed} onChange={() => setSelectedPermissionAllowed(false)} className="accent-red-500" />
                                <span className="text-sm font-medium text-red-700">{text("منع", "Deny")}</span>
                              </label>
                            </div>

                            <div className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
                              {!selectedModule
                                ? text("اختر القسم أولاً.", "Select a module first.")
                                : selectedActions.length === 0
                                  ? text("اختر إجراءً على الأقل.", "Select at least one action.")
                                  : selectedScope === "GROUP" || selectedScope === "OWN"
                                    ? text("هذه الصلاحيات على مستوى المجموعة ولا تحتاج شركة أو فرع.", "These permissions are group-level and require no company or branch.")
                                    : selectedScope === "COMPANY"
                                      ? text("هذه الصلاحيات على مستوى الشركة. حدد الشركات المطلوبة.", "These permissions are company-scoped. Select the target companies.")
                                      : selectedScope === "BRANCH"
                                        ? text("هذه الصلاحيات على مستوى الفرع. حدد الفروع المطلوبة.", "These permissions are branch-scoped. Select the target branches.")
                                        : ""}
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <button type="button" onClick={addDirectPermission} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">
                                {text("إضافة الصلاحية", "Add permission")}
                              </button>
                              <button type="button" onClick={() => handleDirectPermissionsSave(user.id)} disabled={permissionLoading} className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                                {permissionLoading ? text("جارٍ الحفظ...", "Saving...") : text("حفظ الصلاحيات", "Save permissions")}
                              </button>
                              <button type="button" onClick={() => setActivePermissionsUserId(null)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">
                                {text("إغلاق", "Close")}
                              </button>
                            </div>

                            <div className="rounded-lg border">
                              <div className="border-b px-4 py-3 text-sm font-medium">{text("الصلاحيات المباشرة الحالية", "Current direct permissions")}</div>
                              <div className="space-y-2 px-4 py-3">
                                {editingPermissions.length === 0 ? (
                                  <p className="text-sm text-muted-foreground">{text("لا توجد صلاحيات مباشرة حتى الآن", "No direct permissions yet")}</p>
                                ) : (
                                  editingPermissions.map((entry) => (
                                    <div key={`${entry.permissionId}-${entry.scopeKey}`} className="flex flex-col gap-2 rounded-lg border px-3 py-3 md:flex-row md:items-center md:justify-between">
                                      <span className="text-sm">{describeDirectPermission(entry)}</span>
                                      <button type="button" onClick={() => removeDirectPermission(entry.permissionId, entry.scopeKey)} className="self-start rounded-lg border px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 md:self-auto">
                                        {text("إزالة", "Remove")}
                                      </button>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}

                    {isAccessOpen ? (
                      <tr className="border-b border-border/50 bg-muted/20">
                        <td colSpan={canManagePasswords ? 8 : 7} className="px-4 py-4">
                          <CompanyAccessEditor
                            user={user}
                            companies={companies}
                            locale={locale}
                            onCancel={() => setActiveAccessUserId(null)}
                            onSaved={(updated) => {
                              setUsersState((prev) => prev.map((u) => (u.id === user.id ? { ...u, ...updated } : u)));
                              setActiveAccessUserId(null);
                              setSuccess(text("تم تحديث صلاحيات الشركات والفروع.", "Company and branch access updated."));
                            }}
                          />
                        </td>
                      </tr>
                    ) : null}

                    {isRolesOpen ? (
                      <tr className="border-b border-border/50 bg-muted/20">
                        <td colSpan={canManagePasswords ? 8 : 7} className="px-4 py-4">
                          <div className="space-y-4">
                            <div>
                              <h3 className="font-medium">{text("تعديل أدوار المستخدم", "Edit User Roles")}</h3>
                              <p className="text-sm text-muted-foreground">{text("حدد الأدوار والشركات المرتبطة بكل دور", "Select roles and associated companies for each role")}</p>
                            </div>

                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">{text("الأدوار المتاحة", "Available Roles")}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    roles.forEach((role) => {
                                      const exists = editingRoles.some((r) => r.roleId === role.id);
                                      if (!exists) {
                                        setEditingRoles((prev) => [...prev, { roleId: role.id, companyId: null }]);
                                      }
                                    });
                                  }}
                                  className="text-xs text-primary hover:underline"
                                >
                                  {text("إضافة كل الأدوار", "Add all roles")}
                                </button>
                              </div>

                              <div className="grid gap-3">
                                {roles.map((role) => {
                                  const assignedRoles = editingRoles.filter((r) => r.roleId === role.id);
                                  const hasRole = assignedRoles.length > 0;

                                  return (
                                    <div key={role.id} className="rounded-lg border p-3">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <input
                                            type="checkbox"
                                            checked={hasRole}
                                            onChange={(e) => {
                                              if (e.target.checked) {
                                                setEditingRoles((prev) => [...prev, { roleId: role.id, companyId: null }]);
                                              } else {
                                                setEditingRoles((prev) => prev.filter((r) => r.roleId !== role.id));
                                              }
                                            }}
                                          />
                                          <label className="font-medium">{role.nameAr}</label>
                                        </div>
                                      </div>

                                      {hasRole && assignedRoles.map((assignment, idx) => (
                                        <div key={idx} className="mt-2 flex items-center gap-2">
                                          <select
                                            className="input-field flex-1 text-sm"
                                            value={assignment.companyId ?? ""}
                                            onChange={(e) => {
                                              const value = e.target.value || null;
                                              setEditingRoles((prev) =>
                                                prev.map((r, i) =>
                                                  r.roleId === role.id && prev.indexOf(r) === prev.findIndex((x) => x.roleId === role.id && x === r)
                                                    ? { ...r, companyId: value }
                                                    : r
                                                )
                                              );
                                            }}
                                          >
                                            <option value="">{text("كل الشركات (عام)", "All companies (global)")}</option>
                                            {companies.map((company) => (
                                              <option key={company.id} value={company.id}>
                                                {company.nameAr}
                                              </option>
                                            ))}
                                          </select>
                                          {assignedRoles.length > 1 && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const roleIndex = editingRoles.findIndex((r) => r === assignment);
                                                setEditingRoles((prev) => prev.filter((_, i) => i !== roleIndex));
                                              }}
                                              className="rounded border px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                                            >
                                              {text("حذف", "Remove")}
                                            </button>
                                          )}
                                        </div>
                                      ))}

                                      {hasRole && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingRoles((prev) => [...prev, { roleId: role.id, companyId: null }]);
                                          }}
                                          className="mt-2 text-xs text-primary hover:underline"
                                        >
                                          + {text("إضافة هذا الدور لشركة أخرى", "Add this role for another company")}
                                        </button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleRolesSave(user.id)}
                                disabled={roleLoading}
                                className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                              >
                                {roleLoading ? text("جارٍ الحفظ...", "Saving...") : text("حفظ الأدوار", "Save roles")}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveRolesUserId(null);
                                  setEditingRoles([]);
                                }}
                                className="rounded-lg border px-4 py-2 text-sm hover:bg-muted"
                              >
                                {text("إلغاء", "Cancel")}
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}

                    {isPasswordOpen ? (
                      <tr className="border-b border-border/50 bg-muted/20">
                        <td colSpan={canManagePasswords ? 8 : 7} className="px-4 py-4">
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                            <Field label={t("usersManagement.newPassword")} required>
                              <input type="password" className="input-field w-full" value={passwordForm.password} onChange={(event) => setPasswordForm((prev) => ({ ...prev, password: event.target.value }))} />
                            </Field>
                            <Field label={t("usersManagement.confirmPassword")} required>
                              <input type="password" className="input-field w-full" value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm((prev) => ({ ...prev, confirmPassword: event.target.value }))} />
                            </Field>
                            <div className="flex items-end gap-2">
                              <button type="button" onClick={() => handlePasswordReset(user.id)} disabled={passwordLoading} className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                                {passwordLoading ? text("جارٍ الحفظ...", "Saving...") : t("usersManagement.savePassword")}
                              </button>
                              <button type="button" onClick={() => setActivePasswordUserId(null)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">
                                {text("إلغاء", "Cancel")}
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  iconBg,
  value,
  label,
}: {
  icon: React.ReactNode;
  iconBg: string;
  value: number;
  label: string;
}) {
  return (
    <div className="stat-card">
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconBg}`}>{icon}</div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">
        {label} {required ? <span className="text-red-500">*</span> : null}
      </label>
      {children}
    </div>
  );
}

function AccessFlagEditor({
  value,
  onChange,
}: {
  value: AccessFlags;
  onChange: (field: keyof AccessFlags, checked: boolean) => void;
}) {
  const labels: Array<{ key: keyof AccessFlags; label: string }> = [
    { key: "canView", label: "عرض" },
    { key: "canCreate", label: "إنشاء" },
    { key: "canUpdate", label: "تعديل" },
    { key: "canDelete", label: "حذف" },
    { key: "canApprove", label: "اعتماد" },
  ];

  return (
    <div className="flex flex-wrap gap-3">
      {labels.map((item) => (
        <label key={item.key} className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={value[item.key]} onChange={(event) => onChange(item.key, event.target.checked)} />
          <span>{item.label}</span>
        </label>
      ))}
    </div>
  );
}

function CompanyAccessEditor({
  user,
  companies,
  locale,
  onCancel,
  onSaved,
}: {
  user: ExistingUser;
  companies: CompanyOption[];
  locale: "ar" | "en";
  onCancel: () => void;
  onSaved: (updated: Pick<ExistingUser, "companyAccess" | "branchAccess">) => void;
}) {
  const text = (ar: string, en: string) => (locale === "en" ? en : ar);

  const [selectedCompanies, setSelectedCompanies] = useState<Record<string, AccessFlags>>(() =>
    Object.fromEntries(
      user.companyAccess.map((c) => [
        c.companyId,
        { canView: c.canView, canCreate: c.canCreate, canUpdate: c.canUpdate, canDelete: c.canDelete, canApprove: c.canApprove },
      ]),
    ),
  );
  const [selectedBranches, setSelectedBranches] = useState<Record<string, AccessFlags & { companyId: string }>>(() =>
    Object.fromEntries(
      user.branchAccess.map((b) => [
        b.branchId,
        { companyId: b.companyId, canView: b.canView, canCreate: b.canCreate, canUpdate: b.canUpdate, canDelete: b.canDelete, canApprove: b.canApprove },
      ]),
    ),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function toggleCompany(companyId: string) {
    setSelectedCompanies((prev) => {
      if (prev[companyId]) {
        const next = { ...prev };
        delete next[companyId];
        setSelectedBranches((bp) => Object.fromEntries(Object.entries(bp).filter(([, v]) => v.companyId !== companyId)));
        return next;
      }
      return { ...prev, [companyId]: { ...defaultFlags } };
    });
  }

  function toggleBranch(branchId: string, companyId: string) {
    setSelectedBranches((prev) => {
      if (prev[branchId]) {
        const next = { ...prev };
        delete next[branchId];
        return next;
      }
      return { ...prev, [branchId]: { companyId, ...defaultFlags } };
    });
  }

  function updateCompanyFlag(companyId: string, field: keyof AccessFlags, checked: boolean) {
    setSelectedCompanies((prev) => ({ ...prev, [companyId]: { ...prev[companyId], [field]: checked } }));
  }

  function updateBranchFlag(branchId: string, field: keyof AccessFlags, checked: boolean) {
    setSelectedBranches((prev) => ({ ...prev, [branchId]: { ...prev[branchId], [field]: checked } }));
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const companyAccess = Object.entries(selectedCompanies).map(([companyId, flags]) => ({ companyId, ...flags }));
      const branchAccess = Object.entries(selectedBranches).map(([branchId, value]) => ({
        branchId,
        companyId: value.companyId,
        canView: value.canView,
        canCreate: value.canCreate,
        canUpdate: value.canUpdate,
        canDelete: value.canDelete,
        canApprove: value.canApprove,
      }));

      const response = await fetch(`/api/users/${user.id}/access`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyAccess, branchAccess }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error ?? text("فشل في حفظ الصلاحيات", "Failed to save access"));
      }

      const companyNameById = new Map(companies.map((c) => [c.id, c.nameAr]));
      const branchNameById = new Map(companies.flatMap((c) => c.branches).map((b) => [b.id, b.nameAr]));
      onSaved({
        companyAccess: companyAccess.map((c) => ({ ...c, company: { nameAr: companyNameById.get(c.companyId) ?? "" } })),
        branchAccess: branchAccess.map((b) => ({ ...b, branch: { nameAr: branchNameById.get(b.branchId) ?? "" } })),
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : text("فشل في حفظ الصلاحيات", "Failed to save access"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-medium">{text("تعديل الشركات والفروع المصرّح بها", "Edit allowed companies & branches")}</h3>
        <p className="text-sm text-muted-foreground">{text("حدّد الشركات (والفروع داخلها) التي يديرها هذا المستخدم.", "Select the companies (and branches within them) this user manages.")}</p>
      </div>

      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}

      <div className="space-y-4">
        {companies.map((company) => {
          const isSelected = Boolean(selectedCompanies[company.id]);
          return (
            <div key={company.id} className="space-y-4 rounded-xl border bg-card p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <label className="flex items-center gap-3">
                  <input type="checkbox" checked={isSelected} onChange={() => toggleCompany(company.id)} />
                  <div>
                    <p className="font-medium">{company.nameAr}</p>
                    <p className="text-xs text-muted-foreground">{company.type}</p>
                  </div>
                </label>
                {isSelected ? <AccessFlagEditor value={selectedCompanies[company.id]} onChange={(field, checked) => updateCompanyFlag(company.id, field, checked)} /> : null}
              </div>

              {isSelected && company.branches.length > 0 ? (
                <div className="border-t pt-4">
                  <p className="mb-2 text-sm font-medium">{text("الفروع المسموح بها", "Allowed branches")}</p>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {company.branches.map((branch) => {
                      const branchEntry = selectedBranches[branch.id];
                      return (
                        <div key={branch.id} className="space-y-3 rounded-lg border p-3">
                          <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={Boolean(branchEntry)} onChange={() => toggleBranch(branch.id, company.id)} />
                            <span>{branch.nameAr}</span>
                          </label>
                          {branchEntry ? <AccessFlagEditor value={branchEntry} onChange={(field, checked) => updateBranchFlag(branch.id, field, checked)} /> : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <button type="button" onClick={handleSave} disabled={saving} className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {saving ? text("جارٍ الحفظ...", "Saving...") : text("حفظ الصلاحيات", "Save access")}
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">
          {text("إلغاء", "Cancel")}
        </button>
      </div>
    </div>
  );
}
