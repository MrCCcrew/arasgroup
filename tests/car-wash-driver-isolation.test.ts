import assert from "node:assert/strict";
import test from "node:test";
import { carWashDriverMovementScope, isVisibleToCarWashDriver } from "../lib/car-wash/driver-movement-scope";

const companyA = "company-a";
const driverA = "employee-a";
const driverB = "employee-b";

test("same vehicle and day remain isolated by movement creator", () => {
  const movements = [
    { id: "a", vehicleId: "vehicle-x", date: "2026-08-08", companyId: companyA, createdByEmployeeId: driverA },
    { id: "b", vehicleId: "vehicle-x", date: "2026-08-08", companyId: companyA, createdByEmployeeId: driverB },
    { id: "legacy", vehicleId: "vehicle-x", date: "2026-08-08", companyId: companyA, createdByEmployeeId: null },
  ];
  assert.deepEqual(movements.filter((movement) => isVisibleToCarWashDriver(movement, driverA, companyA)).map(({ id }) => id), ["a"]);
  assert.deepEqual(movements.filter((movement) => isVisibleToCarWashDriver(movement, driverB, companyA)).map(({ id }) => id), ["b"]);
  assert.equal(isVisibleToCarWashDriver(movements[1], driverA, companyA), false);
  assert.equal(isVisibleToCarWashDriver(movements[2], driverA, companyA), false);
  assert.equal(isVisibleToCarWashDriver(movements[0], driverA, "company-b"), false);
});

test("database predicate requires both company and exact employee", () => {
  assert.deepEqual(carWashDriverMovementScope(driverA, companyA), {
    createdByEmployeeId: driverA,
    operation: { companyId: companyA },
  });
});
