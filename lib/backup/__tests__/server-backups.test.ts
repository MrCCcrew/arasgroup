/**
 * اختبارات نظام النسخ الاحتياطي الآمن
 *
 * هذه الاختبارات تتحقق من:
 * - Path traversal protection
 * - Date/time validation
 * - Filename validation
 * - Symlink detection
 */

import { validateBackupFilename } from "../server-backups";

describe("validateBackupFilename", () => {
  describe("✅ Valid filenames", () => {
    test("should accept valid filename", () => {
      expect(validateBackupFilename("rashidgroup_db_2026-07-22_03-00-00.sql.gz")).toBe(true);
    });

    test("should accept valid leap year date", () => {
      expect(validateBackupFilename("rashidgroup_db_2024-02-29_12-30-45.sql.gz")).toBe(true);
    });

    test("should accept midnight time", () => {
      expect(validateBackupFilename("rashidgroup_db_2026-01-01_00-00-00.sql.gz")).toBe(true);
    });

    test("should accept max valid time", () => {
      expect(validateBackupFilename("rashidgroup_db_2026-12-31_23-59-59.sql.gz")).toBe(true);
    });
  });

  describe("🛡️ Path traversal attacks", () => {
    test("should reject ../", () => {
      expect(validateBackupFilename("../rashidgroup_db_2026-07-22_03-00-00.sql.gz")).toBe(false);
    });

    test("should reject ..\\", () => {
      expect(validateBackupFilename("..\\rashidgroup_db_2026-07-22_03-00-00.sql.gz")).toBe(false);
    });

    test("should reject path with /", () => {
      expect(validateBackupFilename("backups/rashidgroup_db_2026-07-22_03-00-00.sql.gz")).toBe(false);
    });

    test("should reject Windows absolute path", () => {
      expect(validateBackupFilename("C:\\backups\\rashidgroup_db_2026-07-22_03-00-00.sql.gz")).toBe(false);
    });

    test("should reject Unix absolute path", () => {
      expect(validateBackupFilename("/var/backups/rashidgroup_db_2026-07-22_03-00-00.sql.gz")).toBe(false);
    });

    test("should reject null byte", () => {
      expect(validateBackupFilename("rashidgroup_db_2026-07-22_03-00-00.sql.gz\0.txt")).toBe(false);
    });
  });

  describe("📅 Date validation", () => {
    test("should reject invalid month 13", () => {
      expect(validateBackupFilename("rashidgroup_db_2026-13-01_03-00-00.sql.gz")).toBe(false);
    });

    test("should reject invalid month 00", () => {
      expect(validateBackupFilename("rashidgroup_db_2026-00-01_03-00-00.sql.gz")).toBe(false);
    });

    test("should reject invalid day 32", () => {
      expect(validateBackupFilename("rashidgroup_db_2026-01-32_03-00-00.sql.gz")).toBe(false);
    });

    test("should reject invalid day 00", () => {
      expect(validateBackupFilename("rashidgroup_db_2026-01-00_03-00-00.sql.gz")).toBe(false);
    });

    test("should reject Feb 30", () => {
      expect(validateBackupFilename("rashidgroup_db_2026-02-30_03-00-00.sql.gz")).toBe(false);
    });

    test("should reject Feb 29 in non-leap year", () => {
      expect(validateBackupFilename("rashidgroup_db_2023-02-29_03-00-00.sql.gz")).toBe(false);
    });

    test("should reject April 31", () => {
      expect(validateBackupFilename("rashidgroup_db_2026-04-31_03-00-00.sql.gz")).toBe(false);
    });
  });

  describe("🕐 Time validation", () => {
    test("should reject invalid hour 24", () => {
      expect(validateBackupFilename("rashidgroup_db_2026-07-22_24-00-00.sql.gz")).toBe(false);
    });

    test("should reject invalid hour 25", () => {
      expect(validateBackupFilename("rashidgroup_db_2026-07-22_25-00-00.sql.gz")).toBe(false);
    });

    test("should reject invalid minute 60", () => {
      expect(validateBackupFilename("rashidgroup_db_2026-07-22_03-60-00.sql.gz")).toBe(false);
    });

    test("should reject invalid minute 99", () => {
      expect(validateBackupFilename("rashidgroup_db_2026-07-22_03-99-00.sql.gz")).toBe(false);
    });

    test("should reject invalid second 60", () => {
      expect(validateBackupFilename("rashidgroup_db_2026-07-22_03-00-60.sql.gz")).toBe(false);
    });

    test("should reject invalid second 99", () => {
      expect(validateBackupFilename("rashidgroup_db_2026-07-22_03-00-99.sql.gz")).toBe(false);
    });
  });

  describe("📝 Format validation", () => {
    test("should reject wrong prefix", () => {
      expect(validateBackupFilename("backup_db_2026-07-22_03-00-00.sql.gz")).toBe(false);
    });

    test("should reject missing time", () => {
      expect(validateBackupFilename("rashidgroup_db_2026-07-22.sql.gz")).toBe(false);
    });

    test("should reject not gzipped", () => {
      expect(validateBackupFilename("rashidgroup_db_2026-07-22_03-00-00.sql")).toBe(false);
    });

    test("should reject wrong extension", () => {
      expect(validateBackupFilename("rashidgroup_db_2026-07-22_03-00-00.sql.zip")).toBe(false);
    });

    test("should reject malformed date", () => {
      expect(validateBackupFilename("rashidgroup_db_2026-7-22_03-00-00.sql.gz")).toBe(false);
    });

    test("should reject malformed time", () => {
      expect(validateBackupFilename("rashidgroup_db_2026-07-22_3-0-0.sql.gz")).toBe(false);
    });
  });
});
