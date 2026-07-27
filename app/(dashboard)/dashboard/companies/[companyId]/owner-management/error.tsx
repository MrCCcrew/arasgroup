"use client";
export default function OwnerManagementError({ reset }: { reset: () => void }) { return <div className="page-container p-6 text-center" dir="rtl"><p>تعذر تحميل بيانات إدارة المالك.</p><button className="mt-3 rounded border px-4 py-2" onClick={reset}>إعادة المحاولة</button></div>; }
