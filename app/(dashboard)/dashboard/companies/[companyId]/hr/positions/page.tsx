"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Plus, Pencil, Trash2, Check, X, ToggleLeft, ToggleRight } from "lucide-react";
import Link from "next/link";

interface Position { id: string; nameAr: string; nameEn?: string; isActive: boolean; sortOrder: number; _count: { employees: number } }

export default function PositionsPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [editName, setEditName] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch(`/api/hr/positions?companyId=${companyId}`);
    const data = await res.json();
    if (data.success) setPositions(data.data);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function handleAdd() {
    if (!newName.trim()) return;
    setError("");
    const res = await fetch("/api/hr/positions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, nameAr: newName.trim() }),
    });
    const data = await res.json();
    if (!data.success) { setError(data.error); return; }
    setNewName(""); setAdding(false); load();
  }

  async function handleEdit(id: string) {
    if (!editName.trim()) return;
    await fetch(`/api/hr/positions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nameAr: editName.trim() }),
    });
    setEditId(null); load();
  }

  async function handleToggle(pos: Position) {
    await fetch(`/api/hr/positions/${pos.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !pos.isActive }),
    });
    load();
  }

  async function handleDelete(pos: Position) {
    if (pos._count.employees > 0) { alert(`لا يمكن الحذف — مرتبط بـ ${pos._count.employees} موظف`); return; }
    if (!confirm(`حذف وظيفة "${pos.nameAr}"؟`)) return;
    await fetch(`/api/hr/positions/${pos.id}`, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <Header title="الوظائف" subtitle="إدارة المسميات الوظيفية" companyId={companyId}
        actions={
          <button onClick={() => setAdding(true)}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm hover:bg-primary/90">
            <Plus size={16} /> وظيفة جديدة
          </button>
        }
      />
      <div className="page-container max-w-2xl">
        <Link href={`/dashboard/companies/${companyId}/hr/employees`}
          className="text-sm text-muted-foreground hover:text-foreground mb-2 inline-block">← العودة للموظفين</Link>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2 text-sm">{error}</div>}

        {adding && (
          <div className="section-card flex items-center gap-3">
            <input autoFocus type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") setAdding(false); }}
              className="input-field flex-1" placeholder="اسم الوظيفة بالعربي" />
            <button onClick={handleAdd} className="p-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"><Check size={16} /></button>
            <button onClick={() => { setAdding(false); setNewName(""); }} className="p-2 border rounded-lg hover:bg-muted"><X size={16} /></button>
          </div>
        )}

        <div className="bg-card border rounded-xl overflow-hidden">
          {loading ? (
            <p className="text-center py-8 text-muted-foreground text-sm">جاري التحميل...</p>
          ) : positions.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">لا توجد وظائف — أضف أول وظيفة</p>
          ) : (
            <table className="ar-table">
              <thead><tr><th>المسمى الوظيفي</th><th className="text-center">الموظفون</th><th className="text-center">الحالة</th><th></th></tr></thead>
              <tbody>
                {positions.map((pos) => (
                  <tr key={pos.id} className={`hover:bg-muted/10 ${!pos.isActive ? "opacity-50" : ""}`}>
                    <td>
                      {editId === pos.id ? (
                        <div className="flex items-center gap-2">
                          <input autoFocus type="text" value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") handleEdit(pos.id); if (e.key === "Escape") setEditId(null); }}
                            className="input-field flex-1 py-1 text-sm" />
                          <button onClick={() => handleEdit(pos.id)} className="p-1.5 bg-primary text-primary-foreground rounded"><Check size={13} /></button>
                          <button onClick={() => setEditId(null)} className="p-1.5 border rounded hover:bg-muted"><X size={13} /></button>
                        </div>
                      ) : (
                        <span className="font-medium">{pos.nameAr}</span>
                      )}
                    </td>
                    <td className="text-center text-sm">{pos._count.employees}</td>
                    <td className="text-center">
                      <button onClick={() => handleToggle(pos)} title={pos.isActive ? "إيقاف" : "تفعيل"}>
                        {pos.isActive
                          ? <ToggleRight size={20} className="text-green-500 mx-auto" />
                          : <ToggleLeft size={20} className="text-muted-foreground mx-auto" />}
                      </button>
                    </td>
                    <td>
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => { setEditId(pos.id); setEditName(pos.nameAr); }}
                          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => handleDelete(pos)}
                          className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600">
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
