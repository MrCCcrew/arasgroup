"use client";

import { useMemo, useState } from "react";
import { CheckCircle, Shield, Users, XCircle } from "lucide-react";

interface RoleOption {
  id: string;
  name: string;
  nameAr: string;
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
}

interface Props {
  users: ExistingUser[];
  roles: RoleOption[];
  companies: CompanyOption[];
}

type AccessFlags = {
  canView: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canApprove: boolean;
};

const defaultFlags: AccessFlags = {
  canView: true,
  canCreate: false,
  canUpdate: false,
  canDelete: false,
  canApprove: false,
};

export function UserManagement({ users, roles, companies }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
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

  function updateField<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function toggleRole(roleId: string) {
    setSelectedRoles((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]
    );
  }

  function toggleCompany(companyId: string) {
    setSelectedCompanies((prev) => {
      if (prev[companyId]) {
        const next = { ...prev };
        delete next[companyId];
        setSelectedBranches((branchPrev) => {
          const filtered = Object.fromEntries(
            Object.entries(branchPrev).filter(([, value]) => value.companyId !== companyId)
          );
          return filtered;
        });
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
      };

      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "فشل في إنشاء المستخدم");
      }

      setSuccess("تم إنشاء المستخدم بنجاح. حدّث الصفحة لمراجعة الصلاحيات الفعلية.");
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
      setError(submitError instanceof Error ? submitError.message : "فشل في إنشاء المستخدم");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
            <Users size={20} className="text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{users.length}</p>
            <p className="text-xs text-muted-foreground">إجمالي المستخدمين</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
            <CheckCircle size={20} className="text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{users.filter((user) => user.isActive).length}</p>
            <p className="text-xs text-muted-foreground">مستخدم نشط</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
            <Shield size={20} className="text-purple-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{users.filter((user) => user.isSuperAdmin).length}</p>
            <p className="text-xs text-muted-foreground">مدير نظام</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="section-card space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-bold text-base">إنشاء مستخدم جديد</h2>
            <p className="text-sm text-muted-foreground">تقييد الوصول بالشركة والفروع والوحدات يبدأ من الدور ثم نطاق الوصول.</p>
          </div>
          <div className="text-xs text-muted-foreground">
            {selectedRoles.length} دور • {selectedCompanyIds.length} شركة • {Object.keys(selectedBranches).length} فرع
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}
        {success && <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">{success}</div>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="الاسم العربي" required>
            <input className="input-field w-full" value={form.nameAr} onChange={(event) => updateField("nameAr", event.target.value)} required />
          </Field>
          <Field label="الاسم الإنجليزي">
            <input className="input-field w-full" value={form.nameEn} onChange={(event) => updateField("nameEn", event.target.value)} dir="ltr" />
          </Field>
          <Field label="البريد الإلكتروني" required>
            <input type="email" className="input-field w-full" value={form.email} onChange={(event) => updateField("email", event.target.value)} dir="ltr" required />
          </Field>
          <Field label="الهاتف">
            <input className="input-field w-full" value={form.phone} onChange={(event) => updateField("phone", event.target.value)} dir="ltr" />
          </Field>
          <Field label="كلمة المرور" required>
            <input type="password" className="input-field w-full" value={form.password} onChange={(event) => updateField("password", event.target.value)} required />
          </Field>
          <div className="flex items-end gap-5">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isActive} onChange={(event) => updateField("isActive", event.target.checked)} />
              <span>نشط</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isSuperAdmin} onChange={(event) => updateField("isSuperAdmin", event.target.checked)} />
              <span>Super Admin</span>
            </label>
          </div>
        </div>

        <div>
          <h3 className="font-medium mb-3">الأدوار</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {roles.map((role) => (
              <label key={role.id} className="border rounded-lg px-3 py-3 flex items-center gap-3 hover:bg-muted/30">
                <input type="checkbox" checked={selectedRoles.includes(role.id)} onChange={() => toggleRole(role.id)} />
                <div>
                  <p className="font-medium text-sm">{role.nameAr}</p>
                  <p className="text-xs text-muted-foreground">{role.name}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div>
          <h3 className="font-medium mb-3">صلاحيات الشركات والفروع</h3>
          <div className="space-y-4">
            {companies.map((company) => {
              const isSelected = Boolean(selectedCompanies[company.id]);
              return (
                <div key={company.id} className="border rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <label className="flex items-center gap-3">
                      <input type="checkbox" checked={isSelected} onChange={() => toggleCompany(company.id)} />
                      <div>
                        <p className="font-medium">{company.nameAr}</p>
                        <p className="text-xs text-muted-foreground">{company.type}</p>
                      </div>
                    </label>
                    {isSelected && (
                      <AccessFlagEditor
                        value={selectedCompanies[company.id]}
                        onChange={(field, checked) => updateCompanyFlag(company.id, field, checked)}
                      />
                    )}
                  </div>

                  {isSelected && company.branches.length > 0 && (
                    <div className="border-t pt-4">
                      <p className="text-sm font-medium mb-2">الفروع المسموح بها</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {company.branches.map((branch) => {
                          const branchEntry = selectedBranches[branch.id];
                          return (
                            <div key={branch.id} className="border rounded-lg p-3 space-y-3">
                              <label className="flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={Boolean(branchEntry)}
                                  onChange={() => toggleBranch(branch.id, company.id)}
                                />
                                <span>{branch.nameAr}</span>
                              </label>
                              {branchEntry && (
                                <AccessFlagEditor
                                  value={branchEntry}
                                  onChange={(field, checked) => updateBranchFlag(branch.id, field, checked)}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className="bg-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? "جارٍ الإنشاء..." : "إنشاء المستخدم"}
          </button>
        </div>
      </form>

      <div className="section-card overflow-hidden">
        <h2 className="font-bold text-base mb-4">المستخدمون الحاليون</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">الاسم</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">البريد</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">الأدوار</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">الشركات</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">الفروع</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors align-top">
                  <td className="py-3 px-4">
                    <div>
                      <p className="font-medium">{user.nameAr}</p>
                      {user.isSuperAdmin && <p className="text-xs text-purple-600">Super Admin</p>}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground" dir="ltr">{user.email}</td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1">
                      {user.roles.map((entry) => (
                        <span key={entry.roleId + (entry.companyId ?? "")} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                          {entry.role.nameAr}
                          {entry.company ? ` - ${entry.company.nameAr}` : ""}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1">
                      {user.isSuperAdmin ? (
                        <span className="text-xs text-muted-foreground">جميع الشركات</span>
                      ) : (
                        user.companyAccess.map((entry) => (
                          <span key={entry.companyId} className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                            {entry.company.nameAr}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1">
                      {user.branchAccess.length === 0 ? (
                        <span className="text-xs text-muted-foreground">كل الفروع ضمن الشركة المصرح بها</span>
                      ) : (
                        user.branchAccess.map((entry) => (
                          <span key={entry.branchId} className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
                            {entry.branch.nameAr}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    {user.isActive ? (
                      <span className="flex items-center gap-1 text-xs text-green-600">
                        <CheckCircle size={12} /> نشط
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-red-500">
                        <XCircle size={12} /> موقوف
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
      <label className="block text-sm font-medium mb-1.5">
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
          <input
            type="checkbox"
            checked={value[item.key]}
            onChange={(event) => onChange(item.key, event.target.checked)}
          />
          <span>{item.label}</span>
        </label>
      ))}
    </div>
  );
}
