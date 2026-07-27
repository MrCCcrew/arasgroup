-- Production-safe, additive migration. Do not run automatically.
-- Each column is checked independently because MySQL DDL is autocommit.
SET @owner_management_schema = DATABASE();

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @owner_management_schema AND TABLE_NAME = 'owner_managed_statement_imports' AND COLUMN_NAME = 'cancelledAt') = 0,
  'ALTER TABLE `owner_managed_statement_imports` ADD COLUMN `cancelledAt` DATETIME(3) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @owner_management_schema AND TABLE_NAME = 'owner_managed_statement_imports' AND COLUMN_NAME = 'cancelledById') = 0,
  'ALTER TABLE `owner_managed_statement_imports` ADD COLUMN `cancelledById` VARCHAR(191) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @owner_management_schema AND TABLE_NAME = 'owner_managed_statement_imports' AND COLUMN_NAME = 'cancellationReason') = 0,
  'ALTER TABLE `owner_managed_statement_imports` ADD COLUMN `cancellationReason` TEXT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @owner_management_schema AND TABLE_NAME = 'owner_managed_revenues' AND COLUMN_NAME = 'voidedAt') = 0,
  'ALTER TABLE `owner_managed_revenues` ADD COLUMN `voidedAt` DATETIME(3) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @owner_management_schema AND TABLE_NAME = 'owner_managed_revenues' AND COLUMN_NAME = 'voidedById') = 0,
  'ALTER TABLE `owner_managed_revenues` ADD COLUMN `voidedById` VARCHAR(191) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @owner_management_schema AND TABLE_NAME = 'owner_managed_revenues' AND COLUMN_NAME = 'voidReason') = 0,
  'ALTER TABLE `owner_managed_revenues` ADD COLUMN `voidReason` TEXT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- owner_managed_expenses already has the schema-required soft-delete field: deletedAt.
-- The schema declares no indexes or foreign-key relations for the columns above, so none are added.
