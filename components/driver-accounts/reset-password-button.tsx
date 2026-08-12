"use client";

import { useState } from "react";
import { KeyRound, X } from "lucide-react";

export function ResetDriverPasswordButton({
  companyId,
  userId,
  driverName,
  en,
}: {
  companyId: string;
  userId: string;
  driverName: string;
  en: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function resetPassword() {
    if (password.length < 8) {
      setError(en ? "Password must be at least 8 characters" : "كلمة المرور يجب أن تكون 8 أحرف على الأقل");
      return;
    }
    if (password !== confirmPassword) {
      setError(en ? "Passwords do not match" : "كلمتا المرور غير متطابقتين");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/driver-accounts/${userId}/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, password }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error ?? "Failed to reset password");
      setOpen(false);
      setPassword("");
      setConfirmPassword("");
      alert(en ? "Password reset successfully" : "تمت إعادة تعيين كلمة المرور بنجاح");
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : (en ? "Failed to reset password" : "تعذرت إعادة تعيين كلمة المرور"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button onClick={() => { setError(""); setOpen(true); }} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted">
        <KeyRound size={15} />{en ? "Reset password" : "إعادة تعيين كلمة المرور"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-card p-5 shadow-xl" dir={en ? "ltr" : "rtl"}>
            <div className="flex items-start justify-between gap-4">
              <div><h2 className="text-lg font-semibold">{en ? "Reset password" : "إعادة تعيين كلمة المرور"}</h2><p className="mt-1 text-sm text-muted-foreground">{driverName}</p></div>
              <button onClick={() => setOpen(false)} className="rounded p-1 hover:bg-muted" aria-label={en ? "Close" : "إغلاق"}><X size={18} /></button>
            </div>
            <div className="mt-4 space-y-3">
              <div><label className="mb-1 block text-sm font-medium">{en ? "New password" : "كلمة المرور الجديدة"}</label><input autoFocus type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} className="input-field w-full" /></div>
              <div><label className="mb-1 block text-sm font-medium">{en ? "Confirm password" : "تأكيد كلمة المرور"}</label><input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} className="input-field w-full" /></div>
              <p className="text-xs text-muted-foreground">{en ? "The driver will be required to change this password on their next login." : "سيُطلب من السائق تغيير كلمة المرور عند تسجيل الدخول التالي."}</p>
              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button disabled={saving} onClick={() => setOpen(false)} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50">{en ? "Cancel" : "إلغاء"}</button>
              <button disabled={saving} onClick={resetPassword} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">{saving ? (en ? "Saving..." : "جارٍ الحفظ...") : (en ? "Reset password" : "إعادة التعيين")}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
