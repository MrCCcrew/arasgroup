-- Additive and idempotent. Do not run this file against production without the approved deployment procedure.
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'car_wash_revenues' AND COLUMN_NAME = 'createdByEmployeeId') = 0, 'ALTER TABLE `car_wash_revenues` ADD COLUMN `createdByEmployeeId` VARCHAR(191) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'car_wash_expenses' AND COLUMN_NAME = 'createdByEmployeeId') = 0, 'ALTER TABLE `car_wash_expenses` ADD COLUMN `createdByEmployeeId` VARCHAR(191) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'car_wash_revenues' AND INDEX_NAME = 'cwr_operation_creator_date_idx') = 0, 'CREATE INDEX `cwr_operation_creator_date_idx` ON `car_wash_revenues` (`operationId`, `createdByEmployeeId`, `date`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'car_wash_expenses' AND INDEX_NAME = 'cwe_operation_creator_date_idx') = 0, 'CREATE INDEX `cwe_operation_creator_date_idx` ON `car_wash_expenses` (`operationId`, `createdByEmployeeId`, `date`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'car_wash_revenues' AND CONSTRAINT_NAME = 'cwr_created_by_employee_fk') = 0, 'ALTER TABLE `car_wash_revenues` ADD CONSTRAINT `cwr_created_by_employee_fk` FOREIGN KEY (`createdByEmployeeId`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'car_wash_expenses' AND CONSTRAINT_NAME = 'cwe_created_by_employee_fk') = 0, 'ALTER TABLE `car_wash_expenses` ADD CONSTRAINT `cwe_created_by_employee_fk` FOREIGN KEY (`createdByEmployeeId`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
