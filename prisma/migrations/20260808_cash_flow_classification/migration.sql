-- Additive only. Do not run on production until approved.
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'chart_of_accounts' AND COLUMN_NAME = 'cashFlowCategory') = 0, 'ALTER TABLE `chart_of_accounts` ADD COLUMN `cashFlowCategory` ENUM(''NONE'',''OPERATING'',''INVESTING'',''FINANCING'') NOT NULL DEFAULT ''NONE''', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'chart_of_accounts' AND COLUMN_NAME = 'cashFlowSubcategory') = 0, 'ALTER TABLE `chart_of_accounts` ADD COLUMN `cashFlowSubcategory` VARCHAR(191) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'chart_of_accounts' AND INDEX_NAME = 'coa_cash_flow_category_idx') = 0, 'CREATE INDEX `coa_cash_flow_category_idx` ON `chart_of_accounts` (`companyId`,`cashFlowCategory`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
