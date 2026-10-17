import "server-only";

import { and, asc, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import {
  appointments,
  auditLog,
  customers,
  payments,
  properties,
  servicePlans,
  users,
  vehicles,
} from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { displayName } from "../customers/options";
import { formatAddress } from "../properties/options";
import { TIME_ZONE } from "./options";

export function parseAppointmentId(raw: string) {
  return /^\d+$/.test(raw) ? Number(raw) : null;
}

// Midnight at the start of a calendar date in the business's time zone.
const localMidnight = (date: string) => sql`(${date}::date::timestamp at time zone ${TIME_ZONE})`;

const listColumns = {
  id: appointments.id,
  scheduledStart: appointments.scheduledStart,
  scheduledEnd: appointments.scheduledEnd,
  status: appointments.status,
  priceCents: appointments.priceCents,
  customerId: customers.id,
  customerCode: customers.customerCode,
  firstName: customers.firstName,
  lastName: customers.lastName,
  companyName: customers.companyName,
  street: properties.street,
  unit: properties.unit,
  city: properties.city,
  vehicleName: vehicles.name,
};

// Appointments from `from` up to (not including) `to`, both "YYYY-MM-DD".
export async function getAppointmentsBetween(from: string, to: string) {
  await requireUser();
  return db
    .select(listColumns)
    .from(appointments)
    .innerJoin(customers, eq(customers.id, appointments.customerId))
    .innerJoin(properties, eq(properties.id, appointments.propertyId))
    .leftJoin(vehicles, eq(vehicles.id, appointments.vehicleId))
    .where(
      and(
        gte(appointments.scheduledStart, sql`${localMidnight(from)}`),
        lt(appointments.scheduledStart, sql`${localMidnight(to)}`),
      ),
    )
    .orderBy(asc(appointments.scheduledStart), asc(appointments.id));
}

export async function getCustomerAppointments(customerId: number, limit = 10) {
  await requireUser();
  return db
    .select(listColumns)
    .from(appointments)
    .innerJoin(customers, eq(customers.id, appointments.customerId))
    .innerJoin(properties, eq(properties.id, appointments.propertyId))
    .leftJoin(vehicles, eq(vehicles.id, appointments.vehicleId))
    .where(eq(appointments.customerId, customerId))
    .orderBy(desc(appointments.scheduledStart))
    .limit(limit);
}

const createdBy = alias(users, "created_by_user");
const updatedBy = alias(users, "updated_by_user");

export async function getAppointment(id: number) {
  await requireUser();
  const [row] = await db
    .select({
      appointment: appointments,
      customer: {
        id: customers.id,
        customerCode: customers.customerCode,
        firstName: customers.firstName,
        lastName: customers.lastName,
        companyName: customers.companyName,
      },
      property: properties,
      vehicle: { id: vehicles.id, name: vehicles.name, plate: vehicles.plate },
      plan: { frequency: servicePlans.frequency, rateCents: servicePlans.rateCents },
      createdByName: createdBy.name,
      updatedByName: updatedBy.name,
      paidCents: sql<number>`(select coalesce(sum(${payments.amountCents}), 0)::int from ${payments} where ${payments.appointmentId} = ${appointments.id})`,
    })
    .from(appointments)
    .innerJoin(customers, eq(customers.id, appointments.customerId))
    .innerJoin(properties, eq(properties.id, appointments.propertyId))
    .leftJoin(vehicles, eq(vehicles.id, appointments.vehicleId))
    .leftJoin(servicePlans, eq(servicePlans.id, appointments.servicePlanId))
    .leftJoin(createdBy, eq(createdBy.id, appointments.createdBy))
    .leftJoin(updatedBy, eq(updatedBy.id, appointments.updatedBy))
    .where(eq(appointments.id, id));
  return row ?? null;
}

// The audit trail, with the ids it mentions resolved to names so the history
// can say "Van 2" instead of "vehicle 3".
export async function getAppointmentHistory(id: number) {
  await requireUser();
  const entries = await db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      changedAt: auditLog.changedAt,
      changes: auditLog.changes,
      userName: users.name,
    })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.changedBy))
    .where(and(eq(auditLog.tableName, "appointments"), eq(auditLog.rowId, id)))
    .orderBy(desc(auditLog.changedAt), desc(auditLog.id));

  const ids = { vehicle_id: new Set<number>(), property_id: new Set<number>(), customer_id: new Set<number>() };
  for (const e of entries) {
    const changes = e.changes as Record<string, { from: unknown; to: unknown }>;
    for (const key of Object.keys(ids) as (keyof typeof ids)[]) {
      for (const v of [changes[key]?.from, changes[key]?.to]) if (typeof v === "number") ids[key].add(v);
    }
  }
  const [vehicleRows, propertyRows, customerRows] = await Promise.all([
    ids.vehicle_id.size ? db.select({ id: vehicles.id, name: vehicles.name }).from(vehicles).where(inArray(vehicles.id, [...ids.vehicle_id])) : [],
    ids.property_id.size ? db.select().from(properties).where(inArray(properties.id, [...ids.property_id])) : [],
    ids.customer_id.size
      ? db.select({ id: customers.id, customerCode: customers.customerCode, firstName: customers.firstName, lastName: customers.lastName, companyName: customers.companyName }).from(customers).where(inArray(customers.id, [...ids.customer_id]))
      : [],
  ]);
  const names: Record<string, Record<number, string>> = {
    vehicle_id: Object.fromEntries(vehicleRows.map((v) => [v.id, v.name])),
    property_id: Object.fromEntries(propertyRows.map((p) => [p.id, formatAddress(p)])),
    customer_id: Object.fromEntries(customerRows.map((c) => [c.id, `${displayName(c)} (${c.customerCode})`])),
  };
  return { entries, names };
}

// Everything the booking form needs to choose from.
export async function getBookingOptions() {
  await requireUser();
  const [customerRows, propertyRows, vehicleRows] = await Promise.all([
    db
      .select({
        id: customers.id,
        customerCode: customers.customerCode,
        firstName: customers.firstName,
        lastName: customers.lastName,
        companyName: customers.companyName,
      })
      .from(customers)
      .orderBy(asc(customers.firstName), asc(customers.lastName)),
    db
      .select({
        property: properties,
        isBilling: sql<boolean>`coalesce(${customers.billingPropertyId} = ${properties.id}, false)`,
        planRateCents: servicePlans.rateCents,
      })
      .from(properties)
      .innerJoin(customers, eq(customers.id, properties.customerId))
      .leftJoin(
        servicePlans,
        sql`${servicePlans.propertyId} = ${properties.id} and ${servicePlans.endDate} is null`,
      )
      .orderBy(desc(properties.isActive), asc(properties.street)),
    db.select().from(vehicles).orderBy(desc(vehicles.isActive), asc(vehicles.name)),
  ]);
  return {
    customers: customerRows.map((c) => ({ id: c.id, label: `${displayName(c)} (${c.customerCode})` })),
    properties: propertyRows.map(({ property: p, isBilling, planRateCents }) => ({
      id: p.id,
      customerId: p.customerId,
      label: formatAddress(p) + (p.isActive ? "" : " (inactive)"),
      isBilling,
      planRateCents,
    })),
    vehicles: vehicleRows.map((v) => ({
      id: v.id,
      label: v.name + (v.plate ? ` · ${v.plate}` : "") + (v.isActive ? "" : " (inactive)"),
      isActive: v.isActive,
    })),
  };
}
