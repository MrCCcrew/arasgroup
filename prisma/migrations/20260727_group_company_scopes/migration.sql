-- Multi-group access baseline. Run manually after a verified backup.
-- No DROP, reset, data deletion, or reassignment of companies is performed.
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'hasGlobalGroupAccess') = 0,
  'ALTER TABLE `users` ADD COLUMN `hasGlobalGroupAccess` BOOLEAN NOT NULL DEFAULT false',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'users_global_group_access_idx') = 0,
  'CREATE INDEX `users_global_group_access_idx` ON `users` (`hasGlobalGroupAccess`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
