"use client";

import React, { useState } from "react";
import {
  AlertTriangle, Car, CheckCircle2, Clock, Plus, Pencil,
  Trash2, Wrench, X, ChevronDown, ChevronUp,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { formatDate } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

export type VehicleRow = { id: string; plateNumber: string; make: string | null; model: string | null; ownershipModel?: string };
export type DriverRow  = { id: string; employee: { nameAr: string; nameEn: string | null }; assignedVehicleId?: string | null };

export type Incident = {
  id: string;
  driverId: string;
  vehicleId: string;
  incidentDate: string;
  incidentType: "ACCIDENT" | "BREAKDOWN";
  descriptionAr: string | null;
  status: "OPEN" | "IN_REPAIR" | "RESOLVED";
  replacementSource: "RENTAL_COMPANY" | "OWN_FLEET" | null;
  replacementVehicleId: string | null;
  replacementVehiclePlate: string | null;
  replacementStartDate: string | null;
  replacementEndDate: string | null;
  replacementNotes: string | null;
  garageNameAr: string | null;
  garagePhone: string | null;
  repairStartDate: string | null;
  repairEndDate: string | null;
  repairCost: string | null;
  resolvedDate: string | null;
  notes: string | null;
  driver: { employee: { nameAr: string; nameEn: string | null } };
  vehicle: VehicleRow;
  replacementVehicle: VehicleRow | null;
};

type FormState = {
  driverId: string;
  vehicleId: string;
  incidentDate: string;
  incidentType: "ACCIDENT" | "BREAKDOWN";
  descriptionAr: string;
  // replacement
  replacementSource: "" | "RENTAL_COMPANY" | "OWN_FLEET";
  replacementVehicleId: string;
  replacementVehiclePlate: string;
  replacementStartDate: string;
  replacementEndDate: string;
  replacementNotes: string;
  // garage
  garageNameAr: string;
  garagePhone: string;
  repairStartDate: string;
  repairEndDate: string;
  repairCost: string;
  notes: string;
};

const EMPTY_FORM: FormState = {
  driverId: "", vehicleId: "",
  incidentDate: new Date().toISOString().split("T")[0],
  incidentType: "ACCIDENT",
  descriptionAr: "",
  replacementSource: "", replacementVehicleId: "",
  replacementVehiclePlate: "", replacementStartDate: "", replacementEndDate: "",
  replacementNotes: "",
  garageNameAr: "", garagePhone: "",
  repairStartDate: "", repairEndDate: "", repairCost: "",
  notes: "",
};

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  companyId: string;
  locale: string;
  drivers: DriverRow[];
  ownVehicles: VehicleRow[];
  incidentVehicles: VehicleRow[];
  initialIncidents: Incident[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusBadge(status: string, ar: boolean) {
  if (status === "OPEN")      return <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700"><Clock size={11}/>{ar ? "مفتوح" : "Open"}</span>;
  if (status === "IN_REPAIR") return <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700"><Wrench size={11}/>{ar ? "في الكراج" : "In repair"}</span>;
  return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700"><CheckCircle2 size={11}/>{ar ? "محلول" : "Resolved"}</span>;
}

function typeBadge(type: string, ar: boolean) {
  if (type === "ACCIDENT")  return <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">{ar ? "حادث" : "Accident"}</span>;
  return <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">{ar ? "عطل" : "Breakdown"}</span>;
}

function vLabel(v: VehicleRow | null | undefined) {
  if (!v) return "—";
  return v.make ? `${v.plateNumber} · ${v.make} ${v.model ?? ""}`.trim() : v.plateNumber;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function VehicleIncidentsClient({
  companyId, locale, drivers, ownVehicles, incidentVehicles, initialIncidents,
}: Props) {
  const ar = locale !== "en";

  const [incidents, setIncidents] = useState<Incident[]>(initialIncidents);
  const [statusFilter, setStatusFilter] = useState<"" | "OPEN" | "IN_REPAIR" | "RESOLVED">("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Modal
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [editing, setEditing] = useState<Incident | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Status update loading
  const [statusLoading, setStatusLoading] = useState<string | null>(null);

  async function reload() {
    const res  = await fetch(`/api/delivery/vehicle-incidents?companyId=${companyId}`);
    const json = await res.json();
    if (json.success) setIncidents(json.data);
  }

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModal("add");
  }

  function openEdit(inc: Incident) {
    setEditing(inc);
    setForm({
      driverId:               inc.driverId,
      vehicleId:              inc.vehicleId,
      incidentDate:           inc.incidentDate.split("T")[0],
      incidentType:           inc.incidentType,
      descriptionAr:          inc.descriptionAr ?? "",
      replacementSource:      (inc.replacementSource ?? "") as FormState["replacementSource"],
      replacementVehicleId:   inc.replacementVehicleId ?? "",
      replacementVehiclePlate: inc.replacementVehiclePlate ?? "",
      replacementStartDate:   inc.replacementStartDate ? inc.replacementStartDate.split("T")[0] : "",
      replacementEndDate:     inc.replacementEndDate   ? inc.replacementEndDate.split("T")[0]   : "",
      replacementNotes:       inc.replacementNotes ?? "",
      garageNameAr:           inc.garageNameAr  ?? "",
      garagePhone:            inc.garagePhone   ?? "",
      repairStartDate:        inc.repairStartDate ? inc.repairStartDate.split("T")[0] : "",
      repairEndDate:          inc.repairEndDate   ? inc.repairEndDate.split("T")[0]   : "",
      repairCost:             inc.repairCost ?? "",
      notes:                  inc.notes ?? "",
    });
    setModal("edit");
  }

  async function save() {
    if (!form.driverId || !form.vehicleId || !form.incidentDate) {
      window.alert(ar ? "يرجى تحديد السائق والمركبة والتاريخ" : "Please select driver, vehicle and date");
      return;
    }
    setSaving(true);

    const payload = {
      companyId,
      driverId:               form.driverId,
      vehicleId:              form.vehicleId,
      incidentDate:           form.incidentDate,
      incidentType:           form.incidentType,
      descriptionAr:          form.descriptionAr  || null,
      replacementSource:      form.replacementSource || null,
      replacementVehicleId:   form.replacementSource === "OWN_FLEET" ? (form.replacementVehicleId || null) : null,
      replacementVehiclePlate: form.replacementSource === "RENTAL_COMPANY" ? (form.replacementVehiclePlate || null) : null,
      replacementStartDate:   form.replacementStartDate || null,
      replacementEndDate:     form.replacementEndDate   || null,
      replacementNotes:       form.replacementNotes     || null,
      garageNameAr:           form.garageNameAr   || null,
      garagePhone:            form.garagePhone    || null,
      repairStartDate:        form.repairStartDate || null,
      repairEndDate:          form.repairEndDate   || null,
      repairCost:             form.repairCost ? parseFloat(form.repairCost) : null,
      notes:                  form.notes || null,
    };

    if (modal === "add") {
      const res  = await fetch("/api/delivery/vehicle-incidents", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) { window.alert(json.error); setSaving(false); return; }
    } else if (editing) {
      const res  = await fetch("/api/delivery/vehicle-incidents", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editing.id, ...payload }),
      });
      const json = await res.json();
      if (!json.success) { window.alert(json.error); setSaving(false); return; }
    }

    setSaving(false);
    setModal(null);
    reload();
  }

  async function changeStatus(inc: Incident, newStatus: "OPEN" | "IN_REPAIR" | "RESOLVED") {
    setStatusLoading(inc.id);
    await fetch("/api/delivery/vehicle-incidents", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: inc.id, status: newStatus }),
    });
    setStatusLoading(null);
    reload();
  }

  async function remove(inc: Incident) {
    const msg = ar
      ? `حذف حادثة ${inc.vehicle.plateNumber}؟`
      : `Delete incident for ${inc.vehicle.plateNumber}?`;
    if (!window.confirm(msg)) return;
    await fetch(`/api/delivery/vehicle-incidents?id=${inc.id}`, { method: "DELETE" });
    reload();
  }

  const f = (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [key]: e.target.value }));

  // عند اختيار السائق، نملأ "المركبة المتضررة" تلقائياً بسيارته الحالية المخصّصة
  // (إن وُجدت ضمن قائمة المركبات). يبقى بإمكان المستخدم تغييرها يدوياً.
  function onDriverChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const driverId = e.target.value;
    const driver = drivers.find((d) => d.id === driverId);
    const assignedId = driver?.assignedVehicleId ?? "";
    const exists = assignedId && incidentVehicles.some((v) => v.id === assignedId);
    setForm((p) => ({ ...p, driverId, vehicleId: exists ? assignedId : p.vehicleId }));
  }

  const visible = incidents.filter((i) => !statusFilter || i.status === statusFilter);
  const openCount     = incidents.filter((i) => i.status === "OPEN").length;
  const repairCount   = incidents.filter((i) => i.status === "IN_REPAIR").length;
  const resolvedCount = incidents.filter((i) => i.status === "RESOLVED").length;

  return (
    <div>
      <Header
        title={ar ? "حوادث وإصلاح المركبات" : "Vehicle Incidents & Repairs"}
        subtitle={ar ? "متابعة الحوادث والأعطال والإصلاحات وسيارات البديلة" : "Track accidents, breakdowns, repairs and replacement vehicles"}
        companyId={companyId}
        actions={
          <button
            onClick={openAdd}
            className="btn-primary flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium"
          >
            <Plus size={15} />
            {ar ? "تسجيل حادثة أو إصلاح" : "New incident / repair"}
          </button>
        }
      />

      <div className="page-container space-y-4">

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">{ar ? "الإجمالي" : "Total"}</p>
            <p className="text-2xl font-bold">{incidents.length}</p>
          </div>
          <div className="stat-card cursor-pointer" onClick={() => setStatusFilter(statusFilter === "OPEN" ? "" : "OPEN")}>
            <p className="text-xs text-muted-foreground">{ar ? "مفتوح" : "Open"}</p>
            <p className="text-2xl font-bold text-amber-600">{openCount}</p>
          </div>
          <div className="stat-card cursor-pointer" onClick={() => setStatusFilter(statusFilter === "IN_REPAIR" ? "" : "IN_REPAIR")}>
            <p className="text-xs text-muted-foreground">{ar ? "في الكراج" : "In repair"}</p>
            <p className="text-2xl font-bold text-blue-600">{repairCount}</p>
          </div>
          <div className="stat-card cursor-pointer" onClick={() => setStatusFilter(statusFilter === "RESOLVED" ? "" : "RESOLVED")}>
            <p className="text-xs text-muted-foreground">{ar ? "محلول" : "Resolved"}</p>
            <p className="text-2xl font-bold text-emerald-600">{resolvedCount}</p>
          </div>
        </div>

        {/* ── Filter chips ── */}
        {statusFilter && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{ar ? "فلتر:" : "Filter:"}</span>
            <button
              onClick={() => setStatusFilter("")}
              className="flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs hover:bg-muted/80"
            >
              {statusFilter === "OPEN" ? (ar ? "مفتوح" : "Open")
               : statusFilter === "IN_REPAIR" ? (ar ? "في الكراج" : "In repair")
               : (ar ? "محلول" : "Resolved")}
              <X size={12} />
            </button>
          </div>
        )}

        {/* ── Table ── */}
        <div className="overflow-hidden rounded-xl border bg-card">
          {visible.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
              <Car size={40} className="opacity-30" />
              <p className="text-sm">
                {incidents.length === 0
                  ? (ar ? "لا توجد حوادث مسجلة" : "No incidents recorded")
                  : (ar ? "لا توجد نتائج للفلتر المحدد" : "No results for selected filter")}
              </p>
              {incidents.length === 0 && (
                <button
                  onClick={openAdd}
                  className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm hover:bg-muted"
                >
                  <Plus size={14} />
                  {ar ? "تسجيل أول حادثة" : "Record first incident"}
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="ar-table">
                <thead>
                  <tr>
                    <th>{ar ? "التاريخ" : "Date"}</th>
                    <th>{ar ? "السائق" : "Driver"}</th>
                    <th>{ar ? "المركبة" : "Vehicle"}</th>
                    <th>{ar ? "النوع" : "Type"}</th>
                    <th>{ar ? "البديلة" : "Replacement"}</th>
                    <th>{ar ? "الكراج" : "Garage"}</th>
                    <th>{ar ? "الحالة" : "Status"}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((inc) => (
                    <React.Fragment key={inc.id}>
                      <tr
                        className="cursor-pointer transition-colors hover:bg-muted/20"
                        onClick={() => setExpandedId(expandedId === inc.id ? null : inc.id)}
                      >
                        <td className="whitespace-nowrap text-sm">{formatDate(inc.incidentDate)}</td>
                        <td className="font-medium">{ar ? inc.driver.employee.nameAr : (inc.driver.employee.nameEn ?? inc.driver.employee.nameAr)}</td>
                        <td className="text-sm">{vLabel(inc.vehicle)}</td>
                        <td>{typeBadge(inc.incidentType, ar)}</td>
                        <td className="text-sm text-muted-foreground">
                          {inc.replacementSource === "OWN_FLEET"
                            ? vLabel(inc.replacementVehicle)
                            : inc.replacementSource === "RENTAL_COMPANY"
                              ? (inc.replacementVehiclePlate ?? (ar ? "بديلة من الإيجار" : "Rental replacement"))
                              : "—"}
                        </td>
                        <td className="text-sm text-muted-foreground">{inc.garageNameAr ?? "—"}</td>
                        <td>{statusBadge(inc.status, ar)}</td>
                        <td>
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            {/* Status progression buttons */}
                            {inc.status === "OPEN" && (
                              <button
                                onClick={() => changeStatus(inc, "IN_REPAIR")}
                                disabled={statusLoading === inc.id}
                                title={ar ? "أرسل للكراج" : "Send to garage"}
                                className="rounded-md border px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 disabled:opacity-40"
                              >
                                {ar ? "كراج ↓" : "Repair ↓"}
                              </button>
                            )}
                            {inc.status === "IN_REPAIR" && (
                              <button
                                onClick={() => changeStatus(inc, "RESOLVED")}
                                disabled={statusLoading === inc.id}
                                title={ar ? "تم الحل" : "Mark resolved"}
                                className="rounded-md border px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-50 disabled:opacity-40"
                              >
                                {ar ? "محلول ✓" : "Resolve ✓"}
                              </button>
                            )}
                            {inc.status === "RESOLVED" && (
                              <button
                                onClick={() => changeStatus(inc, "OPEN")}
                                disabled={statusLoading === inc.id}
                                title={ar ? "إعادة فتح" : "Reopen"}
                                className="rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-muted disabled:opacity-40"
                              >
                                {ar ? "إعادة فتح" : "Reopen"}
                              </button>
                            )}
                            <button
                              onClick={() => openEdit(inc)}
                              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                              title={ar ? "تعديل" : "Edit"}
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => remove(inc)}
                              className="rounded-md p-1.5 text-destructive hover:bg-destructive/10"
                              title={ar ? "حذف" : "Delete"}
                            >
                              <Trash2 size={14} />
                            </button>
                            <button
                              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                              title={ar ? "تفاصيل" : "Details"}
                            >
                              {expandedId === inc.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* ── Expanded detail row ── */}
                      {expandedId === inc.id && (
                        <tr key={`${inc.id}-detail`} className="bg-muted/10">
                          <td colSpan={8} className="px-5 py-4">
                            <div className="grid gap-4 sm:grid-cols-3">

                              {/* Description */}
                              {inc.descriptionAr && (
                                <div className="sm:col-span-3">
                                  <p className="mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                    {ar ? "وصف الحادثة" : "Description"}
                                  </p>
                                  <p className="text-sm">{inc.descriptionAr}</p>
                                </div>
                              )}

                              {/* Replacement section */}
                              <div>
                                <p className="mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                  {ar ? "السيارة البديلة" : "Replacement vehicle"}
                                </p>
                                {inc.replacementSource ? (
                                  <div className="space-y-0.5 text-sm">
                                    <p>
                                      <span className="font-medium">
                                        {inc.replacementSource === "RENTAL_COMPANY"
                                          ? (ar ? "من شركة الإيجار" : "From rental company")
                                          : (ar ? "من أسطول الشركة" : "From own fleet")}
                                      </span>
                                    </p>
                                    {(inc.replacementVehicleId || inc.replacementVehiclePlate) && (
                                      <p className="text-muted-foreground">
                                        {inc.replacementSource === "OWN_FLEET"
                                          ? vLabel(inc.replacementVehicle)
                                          : inc.replacementVehiclePlate}
                                      </p>
                                    )}
                                    {inc.replacementStartDate && (
                                      <p className="text-muted-foreground">
                                        {ar ? "من:" : "From:"} {formatDate(inc.replacementStartDate)}
                                        {inc.replacementEndDate ? ` ${ar ? "إلى:" : "to:"} ${formatDate(inc.replacementEndDate)}` : (ar ? " (لم تُرجع بعد)" : " (not returned yet)")}
                                      </p>
                                    )}
                                    {inc.replacementNotes && <p className="text-xs text-muted-foreground">{inc.replacementNotes}</p>}
                                  </div>
                                ) : (
                                  <p className="text-sm text-muted-foreground">{ar ? "لم تُعطَ بديلة بعد" : "No replacement assigned yet"}</p>
                                )}
                              </div>

                              {/* Garage / repair section */}
                              <div>
                                <p className="mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                  {ar ? "الكراج والإصلاح" : "Garage & repair"}
                                </p>
                                {inc.garageNameAr ? (
                                  <div className="space-y-0.5 text-sm">
                                    <p className="font-medium">{inc.garageNameAr}</p>
                                    {inc.garagePhone && <p className="text-muted-foreground">{inc.garagePhone}</p>}
                                    {inc.repairStartDate && (
                                      <p className="text-muted-foreground">
                                        {ar ? "أُرسلت:" : "Sent:"} {formatDate(inc.repairStartDate)}
                                        {inc.repairEndDate ? ` — ${ar ? "عادت:" : "Returned:"} ${formatDate(inc.repairEndDate)}` : (ar ? " (في الكراج)" : " (still in garage)")}
                                      </p>
                                    )}
                                    {inc.repairCost && (
                                      <p className="text-muted-foreground">
                                        {ar ? "تكلفة الإصلاح:" : "Repair cost:"}{" "}
                                        <span className="font-medium text-foreground">{Number(inc.repairCost).toFixed(3)} {ar ? "د.ك" : "KWD"}</span>
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-sm text-muted-foreground">{ar ? "لم يُرسل للكراج بعد" : "Not sent to garage yet"}</p>
                                )}
                              </div>

                              {/* Resolution / notes */}
                              <div>
                                {inc.resolvedDate && (
                                  <>
                                    <p className="mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                      {ar ? "تاريخ الحل" : "Resolved on"}
                                    </p>
                                    <p className="text-sm">{formatDate(inc.resolvedDate)}</p>
                                  </>
                                )}
                                {inc.notes && (
                                  <div className="mt-2">
                                    <p className="mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                      {ar ? "ملاحظات" : "Notes"}
                                    </p>
                                    <p className="text-sm">{inc.notes}</p>
                                  </div>
                                )}
                              </div>

                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
           ADD / EDIT MODAL
      ══════════════════════════════════════════════════════════════ */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-10"
          onClick={() => setModal(null)}
        >
          <div
            className="w-full max-w-xl rounded-xl bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="flex items-center gap-2 font-semibold">
                <AlertTriangle size={18} className="text-amber-500" />
                {modal === "add"
                  ? (ar ? "تسجيل حادثة أو إصلاح" : "Record new incident / repair")
                  : (ar ? "تعديل الحادثة / الإصلاح" : "Edit incident / repair")}
              </h2>
              <button onClick={() => setModal(null)} className="rounded-lg p-1.5 hover:bg-muted">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-5 p-5">

              {/* ── Section 1: Basic info ── */}
              <div className="rounded-lg border bg-muted/20 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {ar ? "معلومات الحادثة" : "Incident details"}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="form-label">{ar ? "السائق" : "Driver"} <span className="text-destructive">*</span></label>
                    <select value={form.driverId} onChange={onDriverChange} className="input-field">
                      <option value="">{ar ? "اختر السائق" : "Select driver"}</option>
                      {drivers.map((d) => (
                        <option key={d.id} value={d.id}>
                          {ar ? d.employee.nameAr : (d.employee.nameEn ?? d.employee.nameAr)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">{ar ? "المركبة المتضررة" : "Affected vehicle"} <span className="text-destructive">*</span></label>
                    <select value={form.vehicleId} onChange={f("vehicleId")} className="input-field">
                      <option value="">{ar ? "اختر المركبة" : "Select vehicle"}</option>
                      {incidentVehicles.map((v) => (
                        <option key={v.id} value={v.id}>{vLabel(v)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">{ar ? "تاريخ الحادثة" : "Incident date"} <span className="text-destructive">*</span></label>
                    <input type="date" value={form.incidentDate} onChange={f("incidentDate")} className="input-field" />
                  </div>
                  <div>
                    <label className="form-label">{ar ? "نوع الحادثة" : "Incident type"}</label>
                    <select value={form.incidentType} onChange={f("incidentType")} className="input-field">
                      <option value="ACCIDENT">{ar ? "حادث" : "Accident"}</option>
                      <option value="BREAKDOWN">{ar ? "عطل" : "Breakdown"}</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="form-label">{ar ? "وصف الحادثة" : "Description"}</label>
                    <textarea
                      value={form.descriptionAr}
                      onChange={f("descriptionAr")}
                      className="input-field min-h-[70px] resize-none"
                      placeholder={ar ? "وصف مختصر..." : "Brief description..."}
                    />
                  </div>
                </div>
              </div>

              {/* ── Section 2: Replacement vehicle ── */}
              <div className="rounded-lg border bg-muted/20 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {ar ? "السيارة البديلة" : "Replacement vehicle"}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="form-label">{ar ? "مصدر البديلة" : "Replacement source"}</label>
                    <select value={form.replacementSource} onChange={f("replacementSource")} className="input-field">
                      <option value="">{ar ? "لا بديلة بعد" : "No replacement yet"}</option>
                      <option value="RENTAL_COMPANY">{ar ? "من شركة الإيجار (البابطين)" : "From rental company (Al-Babtain)"}</option>
                      <option value="OWN_FLEET">{ar ? "من أسطول الشركة" : "From company fleet"}</option>
                    </select>
                  </div>

                  {form.replacementSource === "OWN_FLEET" && (
                    <div className="sm:col-span-2">
                      <label className="form-label">{ar ? "المركبة البديلة" : "Replacement vehicle"}</label>
                      <select value={form.replacementVehicleId} onChange={f("replacementVehicleId")} className="input-field">
                        <option value="">{ar ? "اختر المركبة" : "Select vehicle"}</option>
                        {ownVehicles
                          .filter((v) => v.id !== form.vehicleId)
                          .map((v) => (
                            <option key={v.id} value={v.id}>{vLabel(v)}</option>
                          ))}
                      </select>
                    </div>
                  )}

                  {form.replacementSource === "RENTAL_COMPANY" && (
                    <div className="sm:col-span-2">
                      <label className="form-label">{ar ? "لوحة البديلة (من الإيجار)" : "Replacement plate (rental)"}</label>
                      <input
                        type="text"
                        value={form.replacementVehiclePlate}
                        onChange={f("replacementVehiclePlate")}
                        className="input-field"
                        placeholder={ar ? "مثال: 12345" : "e.g. 12345"}
                      />
                    </div>
                  )}

                  {form.replacementSource && (
                    <>
                      <div>
                        <label className="form-label">{ar ? "تاريخ استلام البديلة" : "Replacement from"}</label>
                        <input type="date" value={form.replacementStartDate} onChange={f("replacementStartDate")} className="input-field" />
                      </div>
                      <div>
                        <label className="form-label">{ar ? "تاريخ إعادة البديلة" : "Replacement returned"}</label>
                        <input type="date" value={form.replacementEndDate} onChange={f("replacementEndDate")} className="input-field" />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="form-label">{ar ? "ملاحظات البديلة" : "Replacement notes"}</label>
                        <input type="text" value={form.replacementNotes} onChange={f("replacementNotes")} className="input-field" placeholder="..." />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* ── Section 3: Garage / repair ── */}
              <div className="rounded-lg border bg-muted/20 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {ar ? "الكراج والإصلاح" : "Garage & repair"}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="form-label">{ar ? "اسم الكراج" : "Garage name"}</label>
                    <input type="text" value={form.garageNameAr} onChange={f("garageNameAr")} className="input-field" placeholder={ar ? "مثال: كراج الخليج" : "e.g. Gulf Garage"} />
                  </div>
                  <div>
                    <label className="form-label">{ar ? "هاتف الكراج" : "Garage phone"}</label>
                    <input type="text" value={form.garagePhone} onChange={f("garagePhone")} className="input-field" placeholder="99999999" />
                  </div>
                  <div>
                    <label className="form-label">{ar ? "تاريخ إرسال السيارة" : "Sent to garage"}</label>
                    <input type="date" value={form.repairStartDate} onChange={f("repairStartDate")} className="input-field" />
                  </div>
                  <div>
                    <label className="form-label">{ar ? "تاريخ عودة السيارة" : "Returned from garage"}</label>
                    <input type="date" value={form.repairEndDate} onChange={f("repairEndDate")} className="input-field" />
                  </div>
                  <div>
                    <label className="form-label">{ar ? "تكلفة الإصلاح (د.ك)" : "Repair cost (KWD)"}</label>
                    <input type="number" step="0.001" min="0" value={form.repairCost} onChange={f("repairCost")} className="input-field" placeholder="0.000" />
                  </div>
                </div>
              </div>

              {/* ── General notes ── */}
              <div>
                <label className="form-label">{ar ? "ملاحظات عامة" : "General notes"}</label>
                <textarea
                  value={form.notes}
                  onChange={f("notes")}
                  className="input-field min-h-[60px] resize-none"
                  placeholder="..."
                />
              </div>

              {/* ── Actions ── */}
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setModal(null)} className="rounded-lg border px-4 py-2 text-sm">
                  {ar ? "إلغاء" : "Cancel"}
                </button>
                <button
                  onClick={save}
                  disabled={saving}
                  className="btn-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  {saving ? (ar ? "جاري الحفظ..." : "Saving...") : (ar ? "حفظ" : "Save")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
