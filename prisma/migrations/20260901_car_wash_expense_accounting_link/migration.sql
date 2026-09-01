-- One accounting expense can be linked to one car-wash operational expense only.
-- This migration is additive and idempotent for the production deployment procedure.
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'car_wash_expenses' AND COLUMN_NAME = 'accountingExpenseId') = 0,
  'ALTER TABLE `car_wash_expenses` ADD COLUMN `accountingExpenseId` VARCHAR(191) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'car_wash_expenses' AND INDEX_NAME = 'cwe_accounting_expense_unique') = 0,
  'CREATE UNIQUE INDEX `cwe_accounting_expense_unique` ON `car_wash_expenses` (`accountingExpenseId`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'car_wash_expenses' AND CONSTRAINT_NAME = 'cwe_accounting_expense_fk') = 0,
  'ALTER TABLE `car_wash_expenses` ADD CONSTRAINT `cwe_accounting_expense_fk` FOREIGN KEY (`accountingExpenseId`) REFERENCES `expenses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
