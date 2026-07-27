-- Owner-management production baseline. Run manually only after a verified backup.
-- MySQL 8+, idempotent where MySQL permits. No DROP, reset, data deletion, or data rewrite.

ALTER TABLE `companies` MODIFY COLUMN `type` ENUM('DELIVERY','CAR_WASH','GENERAL_TRADING','TRADING','HOLDING','OTHER','OWNER_MANAGED') NOT NULL;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'accountType') = 0, 'ALTER TABLE `users` ADD COLUMN `accountType` ENUM(''ADMIN'',''DRIVER'',''CAR_WASH_WORKER'',''OWNER_MANAGED_PARTNER'') NOT NULL DEFAULT ''ADMIN''', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
ALTER TABLE `users` MODIFY COLUMN `accountType` ENUM('ADMIN','DRIVER','CAR_WASH_WORKER','OWNER_MANAGED_PARTNER') NOT NULL DEFAULT 'ADMIN';

CREATE TABLE IF NOT EXISTS `owner_managed_partners` (
  `id` varchar(191) NOT NULL, `companyId` varchar(191) NOT NULL, `userId` varchar(191) NOT NULL, `name` varchar(191) NOT NULL,
  `phone` varchar(191), `email` varchar(191), `mid` varchar(191) NOT NULL, `isActive` boolean NOT NULL DEFAULT true,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`), UNIQUE KEY `omp_user` (`userId`), UNIQUE KEY `omp_company_mid` (`companyId`,`mid`), KEY `omp_company_idx` (`companyId`),
  CONSTRAINT `omp_company` FOREIGN KEY (`companyId`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  CONSTRAINT `omp_user_fk` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `owner_managed_expenses` (
  `id` varchar(191) NOT NULL, `companyId` varchar(191) NOT NULL, `partnerId` varchar(191) NOT NULL, `invoiceDate` datetime(3) NOT NULL,
  `amount` decimal(15,3) NOT NULL, `notes` text, `imageUrl` varchar(191), `ocrRawText` longtext, `createdById` varchar(191) NOT NULL,
  `deletedAt` datetime(3), `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`), KEY `ome_company_partner_date` (`companyId`,`partnerId`,`invoiceDate`),
  CONSTRAINT `ome_company` FOREIGN KEY (`companyId`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ome_partner` FOREIGN KEY (`partnerId`) REFERENCES `owner_managed_partners` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `ome_user` FOREIGN KEY (`createdById`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `owner_managed_statement_imports` (
  `id` varchar(191) NOT NULL, `companyId` varchar(191) NOT NULL, `fileName` varchar(191) NOT NULL, `fileHash` varchar(191) NOT NULL,
  `storageUrl` varchar(191), `rawText` longtext, `importedById` varchar(191) NOT NULL, `confirmedAt` datetime(3), `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), UNIQUE KEY `omsi_hash` (`companyId`,`fileHash`), KEY `omsi_company_created_idx` (`companyId`,`createdAt`),
  CONSTRAINT `omsi_company` FOREIGN KEY (`companyId`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `owner_managed_revenues` (
  `id` varchar(191) NOT NULL, `companyId` varchar(191) NOT NULL, `partnerId` varchar(191), `importId` varchar(191) NOT NULL, `mid` varchar(191),
  `transactionReference` varchar(191), `transactionDate` datetime(3), `postingDate` datetime(3), `amount` decimal(15,3) NOT NULL, `branchCode` varchar(191),
  `description` text NOT NULL, `balance` decimal(15,3), `pageNumber` int NOT NULL, `rawRowText` text,
  `status` enum('MATCHED','UNMATCHED','INVALID','DUPLICATE','REVIEW') NOT NULL DEFAULT 'UNMATCHED', `rejectionReason` text, `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), UNIQUE KEY `omr_dedupe` (`companyId`,`mid`,`transactionReference`,`amount`), KEY `omr_company_partner_date` (`companyId`,`partnerId`,`transactionDate`),
  CONSTRAINT `omr_company` FOREIGN KEY (`companyId`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  CONSTRAINT `omr_partner` FOREIGN KEY (`partnerId`) REFERENCES `owner_managed_partners` (`id`) ON DELETE SET NULL,
  CONSTRAINT `omr_import` FOREIGN KEY (`importId`) REFERENCES `owner_managed_statement_imports` (`id`) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Add required indexes if an earlier partial deployment created the tables.
SET @sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'users_accountType_idx') = 0, 'CREATE INDEX `users_accountType_idx` ON `users` (`accountType`)', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'owner_managed_partners' AND INDEX_NAME = 'omp_company_idx') = 0, 'CREATE INDEX `omp_company_idx` ON `owner_managed_partners` (`companyId`)', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'owner_managed_expenses' AND INDEX_NAME = 'ome_company_partner_date') = 0, 'CREATE INDEX `ome_company_partner_date` ON `owner_managed_expenses` (`companyId`,`partnerId`,`invoiceDate`)', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'owner_managed_statement_imports' AND INDEX_NAME = 'omsi_company_created_idx') = 0, 'CREATE INDEX `omsi_company_created_idx` ON `owner_managed_statement_imports` (`companyId`,`createdAt`)', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'owner_managed_revenues' AND INDEX_NAME = 'omr_company_partner_date') = 0, 'CREATE INDEX `omr_company_partner_date` ON `owner_managed_revenues` (`companyId`,`partnerId`,`transactionDate`)', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
