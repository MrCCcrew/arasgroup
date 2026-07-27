"use client";
export default function PartnerError({ reset }: { reset: () => void }) { return <main className="p-6 text-center" dir="rtl"><p>تعذر تحميل البيانات.</p><button className="mt-3 rounded border px-4 py-2" onClick={reset}>إعادة المحاولة</button></main>; }
