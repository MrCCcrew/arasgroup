/**
 * اختبارات التحقق من صحة نظام النسخ الاحتياطي
 *
 * تشغيل: npx jest lib/backup/__tests__/validation.test.ts
 */

import { validateBackupFilename } from "../server-backups";

describe("Backup Filename Validation", () => {
  describe("Valid filenames", () => {
    test("should accept valid filename", () => {
      expect(validateBackupFilename("rashidgroup_db_2026-07-22_03-00-00.sql.gz")).toBe(true);
    });

    test("should accept leap year date", () => {
      expect(validateBackupFilename("rashidgroup_db_2024-02-29_12-30-45.sql.gz")).toBe(true);
    });

    test("should accept valid edge times", () => {
      expect(validateBackupFilename("rashidgroup_db_2026-12-31_23-59-59.sql.gz")).toBe(true);
      expect(validateBackupFilename("rashidgroup_db_2026-01-01_00-00-00.sql.gz")).toBe(true);
    });
  });

  describe("Invalid dates", () => {
    test("should reject invalid month", () => {
      expect(validateBackupFilename("rashidgroup_db_2026-13-01_03-00-00.sql.gz")).toBe(false);
      expect(validateBackupFilename("rashidgroup_db_2026-00-01_03-00-00.sql.gz")).toBe(false);
    });

    test("should reject invalid day", () => {
      expect(validateBackupFilename("rashidgroup_db_2026-07-32_03-00-00.sql.gz")).toBe(false);
      expect(validateBackupFilename("rashidgroup_db_2026-07-00_03-00-00.sql.gz")).toBe(false);
      expect(validateBackupFilename("rashidgroup_db_2026-02-31_03-00-00.sql.gz")).toBe(false);
    });

    test("should reject invalid leap year date", () => {
      expect(validateBackupFilename("rashidgroup_db_2023-02-29_03-00-00.sql.gz")).toBe(false);
    });

    test("should reject invalid hour", () => {
      expect(validateBackupFilename("rashidgroup_db_2026-07-22_24-00-00.sql.gz")).toBe(false);
      expect(validateBackupFilename("rashidgroup_db_2026-07-22_99-00-00.sql.gz")).toBe(false);
    });

    test("should reject invalid minute", () => {
      expect(validateBackupFilename("rashidgroup_db_2026-07-22_03-60-00.sql.gz")).toBe(false);
      expect(validateBackupFilename("rashidgroup_db_2026-07-22_03-99-00.sql.gz")).toBe(false);
    });

    test("should reject invalid second", () => {
      expect(validateBackupFilename("rashidgroup_db_2026-07-22_03-00-60.sql.gz")).toBe(false);
      expect(validateBackupFilename("rashidgroup_db_2026-07-22_03-00-99.sql.gz")).toBe(false);
    });
  });

  describe("Path traversal protection", () => {
    test("should reject path traversal attempts", () => {
      expect(validateBackupFilename("../../../etc/passwd")).toBe(false);
      expect(validateBackupFilename("..\\..\\..\\windows\\system32\\config\\sam")).toBe(false);
      expect(validateBackupFilename("../rashidgroup_db_2026-07-22_03-00-00.sql.gz")).toBe(false);
    });

    test("should reject encoded traversal", () => {
      expect(validateBackupFilename("%2e%2e/rashidgroup_db_2026-07-22_03-00-00.sql.gz")).toBe(false);
      expect(validateBackupFilename("..%2frashidgroup_db_2026-07-22_03-00-00.sql.gz")).toBe(false);
    });

    test("should reject absolute paths", () => {
      expect(validateBackupFilename("/var/backups/rashidgroup_db_2026-07-22_03-00-00.sql.gz")).toBe(false);
      expect(validateBackupFilename("C:\\backups\\rashidgroup_db_2026-07-22_03-00-00.sql.gz")).toBe(false);
    });

    test("should reject filenames with slashes", () => {
      expect(validateBackupFilename("rashidgroup_db_2026-07-22_03-00-00.sql.gz/../../etc/passwd")).toBe(false);
    });
  });

  describe("Format validation", () => {
    test("should reject wrong prefix", () => {
      expect(validateBackupFilename("backup_2026-07-22_03-00-00.sql.gz")).toBe(false);
    });

    test("should reject wrong extension", () => {
      expect(validateBackupFilename("rashidgroup_db_2026-07-22_03-00-00.sql")).toBe(false);
      expect(validateBackupFilename("rashidgroup_db_2026-07-22_03-00-00.zip")).toBe(false);
    });

    test("should reject missing parts", () => {
      expect(validateBackupFilename("rashidgroup_db_2026-07-22.sql.gz")).toBe(false);
      expect(validateBackupFilename("rashidgroup_db_03-00-00.sql.gz")).toBe(false);
    });

    test("should reject null bytes", () => {
      expect(validateBackupFilename("rashidgroup_db_2026-07-22_03-00-00.sql.gz\0.txt")).toBe(false);
    });
  });
});
