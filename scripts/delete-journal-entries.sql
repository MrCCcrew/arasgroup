-- حذف القيدين المحاسبيين QY-2026-0001 و QY-2026-0002
-- Soft delete - يضع علامة محذوف فقط دون حذف نهائي

UPDATE journal_entries
SET
  isDeleted = 1,
  deletedAt = NOW()
WHERE number IN ('QY-2026-0001', 'QY-2026-0002');

-- التحقق من النتيجة
SELECT
  number,
  descriptionAr,
  isDeleted,
  deletedAt
FROM journal_entries
WHERE number IN ('QY-2026-0001', 'QY-2026-0002');
