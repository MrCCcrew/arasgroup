/** The mandatory server-side ownership predicate for a car-wash driver contribution. */
export function carWashDriverMovementScope(employeeId: string, companyId: string) {
  return {
    createdByEmployeeId: employeeId,
    operation: { companyId },
  };
}

export function isVisibleToCarWashDriver(
  movement: { createdByEmployeeId: string | null; companyId: string },
  employeeId: string,
  companyId: string,
) {
  return movement.companyId === companyId && movement.createdByEmployeeId === employeeId;
}
