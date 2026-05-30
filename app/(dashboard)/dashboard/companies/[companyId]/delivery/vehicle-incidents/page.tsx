import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { VehicleIncidentsClient, type Incident, type VehicleRow, type DriverRow } from "./VehicleIncidentsClient";

interface Props {
  params: Promise<{ companyId: string }>;
}

export default async function VehicleIncidentsPage({ params }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { companyId } = await params;
  const locale = await getLocale();

  // Fetch drivers for the dropdown (with their currently-assigned vehicle for auto-fill)
  const driversRaw = await prisma.driver.findMany({
    where: { employee: { companyId, isActive: true } },
    include: {
      employee: { select: { nameAr: true, nameEn: true } },
      assignedVehicle: { select: { id: true, plateNumber: true, make: true, model: true } },
    },
    orderBy: { employee: { nameAr: "asc" } },
  });

  // Fetch delivery vehicles for the replacement dropdown (own fleet)
  const ownVehiclesRaw = await prisma.vehicle.findMany({
    where: { companyId, isActive: true, type: "DELIVERY" },
    select: { id: true, plateNumber: true, make: true, model: true, ownershipModel: true },
    orderBy: { plateNumber: "asc" },
  });

  // Fetch rented vehicles (main incident vehicles — typically from البابطين)
  const rentedVehiclesRaw = await prisma.vehicle.findMany({
    where: { companyId, isActive: true, ownershipModel: "RENTED" },
    select: { id: true, plateNumber: true, make: true, model: true, ownershipModel: true },
    orderBy: { plateNumber: "asc" },
  });

  // Fetch all incidents
  const incidentsRaw = await prisma.vehicleIncident.findMany({
    where: { companyId },
    include: {
      driver: { include: { employee: { select: { nameAr: true, nameEn: true } } } },
      vehicle: { select: { id: true, plateNumber: true, make: true, model: true } },
      replacementVehicle: { select: { id: true, plateNumber: true, make: true, model: true } },
    },
    orderBy: { incidentDate: "desc" },
  });

  // Serialize — convert Date → ISO string, Decimal → string for client component
  const serialize = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

  const drivers:          DriverRow[]  = driversRaw.map((d) => ({
    id: d.id,
    employee: { nameAr: d.employee.nameAr, nameEn: d.employee.nameEn },
    assignedVehicleId: d.assignedVehicleId ?? null,
  }));

  const toVehicleRow = (v: typeof ownVehiclesRaw[number]): VehicleRow => ({
    id: v.id,
    plateNumber: v.plateNumber,
    make: v.make,
    model: v.model,
    ownershipModel: v.ownershipModel,
  });

  const ownVehicles:      VehicleRow[] = ownVehiclesRaw.map(toVehicleRow);
  const rentedVehicles:   VehicleRow[] = rentedVehiclesRaw.map(toVehicleRow);
  // قائمة "المركبة المتضررة" يجب أن تعرض كل المركبات (المملوكة + المستأجرة)،
  // وليس المستأجرة فقط — مع إزالة التكرار لأن المستأجرة قد تكون من نوع DELIVERY أيضاً.
  const incidentVehicles: VehicleRow[] = Array.from(
    new Map([...ownVehicles, ...rentedVehicles].map((v) => [v.id, v])).values(),
  ).sort((a, b) => a.plateNumber.localeCompare(b.plateNumber, "ar"));

  const incidents: Incident[] = serialize(
    incidentsRaw.map((inc) => ({
      id:                     inc.id,
      driverId:               inc.driverId,
      vehicleId:              inc.vehicleId,
      incidentDate:           inc.incidentDate.toISOString(),
      incidentType:           inc.incidentType,
      descriptionAr:          inc.descriptionAr,
      status:                 inc.status,
      replacementSource:      inc.replacementSource,
      replacementVehicleId:   inc.replacementVehicleId,
      replacementVehiclePlate: inc.replacementVehiclePlate,
      replacementStartDate:   inc.replacementStartDate?.toISOString() ?? null,
      replacementEndDate:     inc.replacementEndDate?.toISOString()   ?? null,
      replacementNotes:       inc.replacementNotes,
      garageNameAr:           inc.garageNameAr,
      garagePhone:            inc.garagePhone,
      repairStartDate:        inc.repairStartDate?.toISOString() ?? null,
      repairEndDate:          inc.repairEndDate?.toISOString()   ?? null,
      repairCost:             inc.repairCost?.toString()         ?? null,
      resolvedDate:           inc.resolvedDate?.toISOString()    ?? null,
      notes:                  inc.notes,
      driver: {
        employee: {
          nameAr: inc.driver.employee.nameAr,
          nameEn:  inc.driver.employee.nameEn,
        },
      },
      vehicle: {
        id:          inc.vehicle.id,
        plateNumber: inc.vehicle.plateNumber,
        make:        inc.vehicle.make,
        model:       inc.vehicle.model,
      },
      replacementVehicle: inc.replacementVehicle
        ? {
            id:          inc.replacementVehicle.id,
            plateNumber: inc.replacementVehicle.plateNumber,
            make:        inc.replacementVehicle.make,
            model:       inc.replacementVehicle.model,
          }
        : null,
    })),
  );

  return (
    <VehicleIncidentsClient
      companyId={companyId}
      locale={locale}
      drivers={drivers}
      ownVehicles={ownVehicles}
      incidentVehicles={incidentVehicles}
      initialIncidents={incidents}
    />
  );
}
