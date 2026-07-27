-- Car-wash portal metadata. Run manually after backup; do not use migrate reset/db push.
-- Adds nullable/defaulted columns only. Existing movements remain source=ADMIN.
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='car_wash_revenues' AND COLUMN_NAME='paymentMethod')=0, 'ALTER TABLE `car_wash_revenues` ADD COLUMN `paymentMethod` varchar(32) NOT NULL DEFAULT ''CASH''', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='car_wash_revenues' AND COLUMN_NAME='imageUrl')=0, 'ALTER TABLE `car_wash_revenues` ADD COLUMN `imageUrl` varchar(191) NULL', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='car_wash_revenues' AND COLUMN_NAME='ocrRawText')=0, 'ALTER TABLE `car_wash_revenues` ADD COLUMN `ocrRawText` longtext NULL', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='car_wash_revenues' AND COLUMN_NAME='transactionReference')=0, 'ALTER TABLE `car_wash_revenues` ADD COLUMN `transactionReference` varchar(191) NULL', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='car_wash_revenues' AND COLUMN_NAME='source')=0, 'ALTER TABLE `car_wash_revenues` ADD COLUMN `source` varchar(32) NOT NULL DEFAULT ''ADMIN''', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='car_wash_revenues' AND COLUMN_NAME='createdById')=0, 'ALTER TABLE `car_wash_revenues` ADD COLUMN `createdById` varchar(191) NULL', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='car_wash_expenses' AND COLUMN_NAME='paymentMethod')=0, 'ALTER TABLE `car_wash_expenses` ADD COLUMN `paymentMethod` varchar(32) NOT NULL DEFAULT ''CASH''', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='car_wash_expenses' AND COLUMN_NAME='imageUrl')=0, 'ALTER TABLE `car_wash_expenses` ADD COLUMN `imageUrl` varchar(191) NULL', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='car_wash_expenses' AND COLUMN_NAME='ocrRawText')=0, 'ALTER TABLE `car_wash_expenses` ADD COLUMN `ocrRawText` longtext NULL', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='car_wash_expenses' AND COLUMN_NAME='source')=0, 'ALTER TABLE `car_wash_expenses` ADD COLUMN `source` varchar(32) NOT NULL DEFAULT ''ADMIN''', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='car_wash_expenses' AND COLUMN_NAME='createdById')=0, 'ALTER TABLE `car_wash_expenses` ADD COLUMN `createdById` varchar(191) NULL', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'car_wash_revenues' AND INDEX_NAME = 'cwr_source_date_idx') = 0,
  'CREATE INDEX `cwr_source_date_idx` ON `car_wash_revenues` (`source`,`date`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'car_wash_expenses' AND INDEX_NAME = 'cwe_source_date_idx') = 0,
  'CREATE INDEX `cwe_source_date_idx` ON `car_wash_expenses` (`source`,`date`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
