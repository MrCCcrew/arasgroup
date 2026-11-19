SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 1;

-- =========================================================
-- 1. USERS: Driver Portal account linkage
-- =========================================================

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `users` ADD COLUMN `employeeId` VARCHAR(191) COLLATE utf8mb4_unicode_ci NULL AFTER `isSuperAdmin`',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'employeeId'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `users` ADD COLUMN `accountType` ENUM(''ADMIN'',''DRIVER'',''CAR_WASH_WORKER'') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT ''ADMIN'' AFTER `employeeId`',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'accountType'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `users` ADD COLUMN `mustChangePassword` TINYINT(1) NOT NULL DEFAULT 0 AFTER `accountType`',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'mustChangePassword'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'CREATE UNIQUE INDEX `users_employeeId_key` ON `users` (`employeeId`)',
    'SELECT 1'
  )
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND INDEX_NAME = 'users_employeeId_key'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'CREATE INDEX `users_accountType_idx` ON `users` (`accountType`)',
    'SELECT 1'
  )
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND INDEX_NAME = 'users_accountType_idx'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `users` ADD CONSTRAINT `users_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees` (`id`) ON DELETE SET NULL ON UPDATE CASCADE',
    'SELECT 1'
  )
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND CONSTRAINT_NAME = 'users_employeeId_fkey'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =========================================================
-- 2. DELIVERY INVOICES: review workflow
-- =========================================================

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `delivery_invoices` ADD COLUMN `reviewStatus` ENUM(''PENDING_REVIEW'',''APPROVED'',''REJECTED'') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT ''APPROVED'' AFTER `deletedAt`',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'delivery_invoices'
    AND COLUMN_NAME = 'reviewStatus'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `delivery_invoices` ADD COLUMN `reviewedById` VARCHAR(191) COLLATE utf8mb4_unicode_ci NULL AFTER `reviewStatus`',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'delivery_invoices'
    AND COLUMN_NAME = 'reviewedById'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `delivery_invoices` ADD COLUMN `reviewedAt` DATETIME(3) NULL AFTER `reviewedById`',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'delivery_invoices'
    AND COLUMN_NAME = 'reviewedAt'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `delivery_invoices` ADD COLUMN `rejectionReason` VARCHAR(500) COLLATE utf8mb4_unicode_ci NULL AFTER `reviewedAt`',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'delivery_invoices'
    AND COLUMN_NAME = 'rejectionReason'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `delivery_invoices` ADD COLUMN `uploadSource` ENUM(''ADMIN'',''DRIVER_WEB'',''DRIVER_MOBILE'') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT ''ADMIN'' AFTER `rejectionReason`',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'delivery_invoices'
    AND COLUMN_NAME = 'uploadSource'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `delivery_invoices` ADD COLUMN `clientGeneratedId` VARCHAR(191) COLLATE utf8mb4_unicode_ci NULL AFTER `uploadSource`',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'delivery_invoices'
    AND COLUMN_NAME = 'clientGeneratedId'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'CREATE INDEX `delivery_invoices_reviewStatus_idx` ON `delivery_invoices` (`reviewStatus`)',
    'SELECT 1'
  )
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'delivery_invoices'
    AND INDEX_NAME = 'delivery_invoices_reviewStatus_idx'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'CREATE INDEX `delivery_invoices_uploadSource_idx` ON `delivery_invoices` (`uploadSource`)',
    'SELECT 1'
  )
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'delivery_invoices'
    AND INDEX_NAME = 'delivery_invoices_uploadSource_idx'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'CREATE INDEX `delivery_invoices_clientGeneratedId_idx` ON `delivery_invoices` (`clientGeneratedId`)',
    'SELECT 1'
  )
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'delivery_invoices'
    AND INDEX_NAME = 'delivery_invoices_clientGeneratedId_idx'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'CREATE UNIQUE INDEX `delivery_invoices_scope_client_id_key` ON `delivery_invoices` (`companyId`,`employeeId`,`clientGeneratedId`)',
    'SELECT 1'
  )
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'delivery_invoices'
    AND INDEX_NAME = 'delivery_invoices_scope_client_id_key'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `delivery_invoices` ADD CONSTRAINT `delivery_invoices_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE',
    'SELECT 1'
  )
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'delivery_invoices'
    AND CONSTRAINT_NAME = 'delivery_invoices_reviewedById_fkey'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Preserve the behavior of all historical invoices explicitly.
UPDATE `delivery_invoices`
SET
  `reviewStatus` = 'APPROVED',
  `uploadSource` = 'ADMIN'
WHERE `reviewStatus` IS NULL
   OR `uploadSource` IS NULL;

-- =========================================================
-- 3. DRIVER GPS TRACKING
-- =========================================================

CREATE TABLE IF NOT EXISTS `driver_tracking_sessions` (
  `id` VARCHAR(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `userId` VARCHAR(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `employeeId` VARCHAR(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` VARCHAR(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `driverId` VARCHAR(191) COLLATE utf8mb4_unicode_ci NULL,
  `carWashWorkerId` VARCHAR(191) COLLATE utf8mb4_unicode_ci NULL,
  `status` ENUM('ACTIVE','PAUSED','ENDED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `endedAt` DATETIME(3) NULL,
  `deviceInfo` VARCHAR(191) COLLATE utf8mb4_unicode_ci NULL,
  `consentedAt` DATETIME(3) NULL,
  `consentVersion` VARCHAR(191) COLLATE utf8mb4_unicode_ci NULL,
  `consentLocale` VARCHAR(191) COLLATE utf8mb4_unicode_ci NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  KEY `driver_tracking_sessions_userId_status_idx` (`userId`,`status`),
  KEY `driver_tracking_sessions_companyId_startedAt_idx` (`companyId`,`startedAt`),
  KEY `driver_tracking_sessions_employeeId_idx` (`employeeId`),

  CONSTRAINT `driver_tracking_sessions_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `driver_location_points` (
  `id` VARCHAR(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sessionId` VARCHAR(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `companyId` VARCHAR(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `employeeId` VARCHAR(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `driverId` VARCHAR(191) COLLATE utf8mb4_unicode_ci NULL,
  `carWashWorkerId` VARCHAR(191) COLLATE utf8mb4_unicode_ci NULL,
  `latitude` DECIMAL(10,7) NOT NULL,
  `longitude` DECIMAL(10,7) NOT NULL,
  `accuracy` DECIMAL(6,2) NULL,
  `altitude` DECIMAL(8,2) NULL,
  `heading` DECIMAL(5,2) NULL,
  `speed` DECIMAL(6,2) NULL,
  `recordedAt` DATETIME(3) NOT NULL,
  `receivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `source` VARCHAR(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'WEB_GPS',
  `clientGeneratedId` VARCHAR(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  UNIQUE KEY `driver_location_points_clientGeneratedId_key` (`clientGeneratedId`),
  KEY `driver_location_points_companyId_employeeId_recordedAt_idx` (`companyId`,`employeeId`,`recordedAt`),
  KEY `driver_location_points_sessionId_recordedAt_idx` (`sessionId`,`recordedAt`),
  KEY `driver_location_points_clientGeneratedId_idx` (`clientGeneratedId`),

  CONSTRAINT `driver_location_points_sessionId_fkey`
    FOREIGN KEY (`sessionId`) REFERENCES `driver_tracking_sessions` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- 4. DEFINE PERMISSION ONLY — DO NOT ASSIGN TO ANY ROLE
-- =========================================================

INSERT INTO `permissions` (`id`,`module`,`action`,`scope`,`resource`)
SELECT
  UUID(),
  'DELIVERY_INVOICES',
  'APPROVE',
  'COMPANY',
  'GENERAL'
WHERE NOT EXISTS (
  SELECT 1
  FROM `permissions`
  WHERE `module` = 'DELIVERY_INVOICES'
    AND `action` = 'APPROVE'
    AND `scope` = 'COMPANY'
);

