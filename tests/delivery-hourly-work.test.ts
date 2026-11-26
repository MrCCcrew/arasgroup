import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { hourlyAmount, hourlyEntrySchema, hourlyRateSchema, parseWorkDate, resolveHourlyRate } from "../lib/delivery/hourly-work";
import { contractFields, contractInputError } from "../lib/delivery/contract-input";

assert.equal(hourlyAmount(480, "1.250").toFixed(3), "10.000");
assert.equal(hourlyAmount(90, "1.333").toFixed(3), "2.000");
assert.equal(hourlyAmount(1, "1.000").toFixed(3), "0.017");
assert.equal(hourlyAmount(1440, "2.000").toFixed(3), "48.000");
for (const minutes of [0, -1, 1441, 1.5, NaN]) assert.throws(() => hourlyAmount(minutes, "1.000"));
for (const rate of [0, -1, Infinity, NaN, 1.2345, 100001]) assert.equal(hourlyRateSchema.safeParse(rate).success, false);
assert.equal(parseWorkDate("2026-02-30"), null);
assert.equal(parseWorkDate("2024-02-29")?.toISOString(), "2024-02-29T00:00:00.000Z");

const base = { action: "entry", driverId: "driver", workEntityId: "eyed", date: "2026-09-20", minutes: 480, hourlyRate: 1.250 };
for (const ordersCount of [0, 1, 50, 1000]) {
  const row = hourlyEntrySchema.parse({ ...base, ordersCount });
  assert.equal(hourlyAmount(row.minutes, row.hourlyRate!).toFixed(3), "10.000", "order count must never change hourly earnings");
}
for (const ordersCount of [-1, 1.5, Infinity]) assert.equal(hourlyEntrySchema.safeParse({ ...base, ordersCount }).success, false);
const decimal = (value: number) => new Prisma.Decimal(value);
const entity = { id: "eyed", hourlyRate: decimal(2) };
assert.equal(resolveHourlyRate(undefined, null, entity, decimal(1))?.toString(), "2");
assert.equal(resolveHourlyRate(undefined, null, { ...entity, hourlyRate: null }, decimal(1))?.toString(), "1");
assert.equal(resolveHourlyRate(undefined, { workEntityId: "eyed", hourlyRate: decimal(1.5) }, entity, decimal(1))?.toString(), "1.5", "historical rates survive later entity price changes");
assert.equal(resolveHourlyRate(undefined, { workEntityId: "other", hourlyRate: decimal(1.5) }, entity, decimal(1))?.toString(), "2", "moving work to a different entity uses its rate");
assert.equal(resolveHourlyRate(3, null, entity, decimal(1)), 3);

const contract = contractFields.parse({ nameAr: "RoPops", platform: "CUSTOM", nameEn: null, startDate: "2026-09-01", endDate: null, notes: null, usesHourlyWork: true, defaultHourlyRate: 1.5 });
assert.equal(contractInputError({ ...contract, usesHourlyWork: true }), null);
assert.ok(contractInputError({ ...contract, usesHourlyWork: true, defaultHourlyRate: null }));
assert.ok(contractInputError({ ...contract, usesHourlyWork: false, endDate: new Date("2026-08-01") }));
console.log("Delivery hourly work tests passed: rates, snapshots, rounding, dates and orders independent of earnings");
