"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Check, Pencil, Plus, ToggleLeft, ToggleRight, Trash2, X } from "lucide-react";
import { Header } from "@/components/layout/header";
import { getAllowedEmployeeTypes } from "@/lib/hr/company-employee-rules";

interface Position {
  id: string;
  nameAr: string;
  nameEn?: string;
  isActive: boolean;
  sortOrder: number;
  _count: { employees: number };
}

export default function PositionsPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const [companyType, setCompanyType] = useState("OTHER");
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [editName, setEditName] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const response = await fetch(`/api/hr/positions?companyId=${companyId}`);
    const payload = await response.json();
    if (payload.success) setPositions(payload.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    fetch(`/api/companies/${companyId}`)
      .then((response) => response.json())
      .then((payload) => {
        if (payload.success) setCompanyType(payload.data.type);
      })
      .catch(() => {});
  }, [companyId]);

  async function handleAdd() {
    if (!newName.trim()) return;
    setError("");

    const response = await fetch("/api/hr/positions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, nameAr: newName.trim() }),
    });

    const payload = await response.json();
    if (!payload.success) {
      setError(payload.error);
      return;
    }

    setNewName("");
    setAdding(false);
    load();
  }

  async function handleEdit(id: string) {
    if (!editName.trim()) return;
    await fetch(`/api/hr/positions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nameAr: editName.trim() }),
    });
    setEditId(null);
    load();
  }

  async function handleToggle(position: Position) {
    await fetch(`/api/hr/positions/${position.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !position.isActive }),
    });
    load();
  }

  async function handleDelete(position: Position) {
    if (position._count.employees > 0) {
      alert(`لا يمكن الحذف - مرتبط بـ ${position._count.employees} موظف`);
      return;
    }
    if (!confirm(`حذف وظيفة "${position.nameAr}"؟`)) return;
    await fetch(`/api/hr/positions/${position.id}`, { method: "DELETE" });
    load();
  }

  const allowedTypes = getAllowedEmployeeTypes(companyType);
  const isCarWashCompany = companyType === "CAR_WASH";

  return (
    <div>
      <Header
        title="الوظائف"
        subtitle="إدارة المسميات الوظيفية"
        companyId={companyId}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {isCarWashCompany && allowedTypes.includes("OFFICE_EMPLOYEE") && (
              <Link
                href={`/dashboard/companies/${companyId}/hr/employees/new?type=OFFICE_EMPLOYEE`}
                className="rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
              >
                موظف جديد
              </Link>
            )}
            {isCarWashCompany && allowedTypes.includes("CAR_WASH_WORKER") && (
              <Link
                href={`/dashboard/companies/${companyId}/hr/employees/new?type=CAR_WASH_WORKER`}
                className="rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
              >
                عامل غسيل
              </Link>
            )}
            {isCarWashCompany && allowedTypes.includes("CAR_WASH_DRIVER") && (
              <Link
                href={`/dashboard/companies/${companyId}/hr/employees/new?type=CAR_WASH_DRIVER`}
                className="rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
              >
                سائق غسيل
              </Link>
            )}
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
            >
              <Plus size={16} /> وظيفة جديدة
            </button>
          </div>
        }
      />

      <div className="page-container max-w-2xl">
        <Link
          href={`/dashboard/companies/${companyId}/hr/employees`}
          className="mb-2 inline-block text-sm text-muted-foreground hover:text-foreground"
        >
          ← العودة للموظفين
        </Link>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

        {adding && (
          <div className="section-card flex items-center gap-3">
            <input
              autoFocus
              type="text"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleAdd();
                if (event.key === "Escape") setAdding(false);
              }}
              className="input-field flex-1"
              placeholder="اسم الوظيفة بالعربي"
            />
            <button onClick={handleAdd} className="rounded-lg bg-primary p-2 text-primary-foreground hover:bg-primary/90">
              <Check size={16} />
            </button>
            <button
              onClick={() => {
                setAdding(false);
                setNewName("");
              }}
              className="rounded-lg border p-2 hover:bg-muted"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <div className="overflow-hidden rounded-xl border bg-card">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">جارٍ التحميل...</p>
          ) : positions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">لا توجد وظائف - أضف أول وظيفة</p>
          ) : (
            <table className="ar-table">
              <thead>
                <tr>
                  <th>المسمى الوظيفي</th>
                  <th className="text-center">الموظفون</th>
                  <th className="text-center">الحالة</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {positions.map((position) => (
                  <tr key={position.id} className={`hover:bg-muted/10 ${!position.isActive ? "opacity-50" : ""}`}>
                    <td>
                      {editId === position.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            autoFocus
                            type="text"
                            value={editName}
                            onChange={(event) => setEditName(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") handleEdit(position.id);
                              if (event.key === "Escape") setEditId(null);
                            }}
                            className="input-field flex-1 py-1 text-sm"
                          />
                          <button onClick={() => handleEdit(position.id)} className="rounded bg-primary p-1.5 text-primary-foreground">
                            <Check size={13} />
                          </button>
                          <button onClick={() => setEditId(null)} className="rounded border p-1.5 hover:bg-muted">
                            <X size={13} />
                          </button>
                        </div>
                      ) : (
                        <span className="font-medium">{position.nameAr}</span>
                      )}
                    </td>
                    <td className="text-center text-sm">{position._count.employees}</td>
                    <td className="text-center">
                      <button onClick={() => handleToggle(position)} title={position.isActive ? "إيقاف" : "تفعيل"}>
                        {position.isActive ? (
                          <ToggleRight size={20} className="mx-auto text-green-500" />
                        ) : (
                          <ToggleLeft size={20} className="mx-auto text-muted-foreground" />
                        )}
                      </button>
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setEditId(position.id);
                            setEditName(position.nameAr);
                          }}
                          className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(position)}
                          className="rounded p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
