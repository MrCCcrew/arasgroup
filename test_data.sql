-- Test Data for Driver Portal MVP

INSERT INTO `groups` (id, nameAr, nameEn, createdAt, updatedAt)
VALUES ('test_group_001', 'Test Group', 'Test Group', NOW(), NOW())
ON DUPLICATE KEY UPDATE nameAr=nameAr;

INSERT INTO companies (id, groupId, nameAr, nameEn, type, createdAt, updatedAt)
VALUES
  ('test_delivery_001', 'test_group_001', 'Test Delivery', 'Test Delivery', 'DELIVERY', NOW(), NOW()),
  ('test_carwash_001', 'test_group_001', 'Test CarWash', 'Test CarWash', 'CAR_WASH', NOW(), NOW())
ON DUPLICATE KEY UPDATE nameAr=nameAr;

INSERT INTO employees (id, companyId, nameAr, nameEn, type, createdAt, updatedAt)
VALUES
  ('test_emp_delivery_001', 'test_delivery_001', 'Driver Test 1', 'Driver Test 1', 'DRIVER', NOW(), NOW()),
  ('test_emp_delivery_002', 'test_delivery_001', 'Driver Test 2', 'Driver Test 2', 'DRIVER', NOW(), NOW()),
  ('test_emp_carwash_001', 'test_carwash_001', 'Worker Test 1', 'Worker Test 1', 'CAR_WASH_WORKER', NOW(), NOW())
ON DUPLICATE KEY UPDATE nameAr=nameAr;

INSERT INTO drivers (id, employeeId, updatedAt)
VALUES
  ('test_driver_001', 'test_emp_delivery_001', NOW()),
  ('test_driver_002', 'test_emp_delivery_002', NOW())
ON DUPLICATE KEY UPDATE employeeId=employeeId;

INSERT INTO car_wash_workers (id, employeeId)
VALUES ('test_worker_001', 'test_emp_carwash_001')
ON DUPLICATE KEY UPDATE employeeId=employeeId;

SELECT 'OK' AS status;
