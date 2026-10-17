"use server";

import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { appointments, customers, gpsStops, payments, properties, servicePlans, vehicles } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { asUser, pgError } from "@/lib/db-helpers";
import { displayName } from "../customers/options";
import {
  appointmentStatuses,
  formatTimeRange,
  TIME_ZONE,
  toLocalInputs,
  type AppointmentStatus,
} from "./options";

export type AppointmentField =
  | "customerId"
  | "propertyId"
  | "vehicleId"
  | "date"
  | "start"
  | "end"
  | "price"
  | "status"
  | "notes";

export type AppointmentFormState = {
  errors?: Partial<Record<AppointmentField, string>>;
  message?: string;
};

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value);
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function parse(formData: FormData) {
  const text = (name: AppointmentField) => {
    const value = formData.get(name);
    return typeof value === "string" ? value.trim() : "";
  };
  const id = (name: AppointmentField) => {
    const raw = text(name);
    return /^\d+$/.test(raw) ? Number(raw) : null;
  };
  const errors: NonNullable<AppointmentFormState["errors"]> = {};

  const customerId = id("customerId");
  if (customerId === null) errors.customerId = "Choose a customer.";
  const propertyId = id("propertyId");
  if (propertyId === null) errors.propertyId = "Choose one of the customer's properties.";
  const vehicleId = id("vehicleId");
  if (vehicleId === null) errors.vehicleId = "Choose the vehicle.";

  const date = text("date");
  const start = text("start");
  const end = text("end");
  if (!isValidDate(date)) errors.date = "Enter a valid date.";
  if (!TIME_RE.test(start)) errors.start = "Enter a start time.";
  if (!TIME_RE.test(end)) errors.end = "Enter an end time.";
  // "HH:MM" strings compare correctly; appointments don't run past midnight
  else if (TIME_RE.test(start) && end <= start) errors.end = "End time must be after the start time.";

  const rawPrice = text("price").replace(/[$,\s]/g, "");
  const priceCents = /^\d+(\.\d{1,2})?$/.test(rawPrice) ? Math.round(Number(rawPrice) * 100) : null;
  if (priceCents === null) errors.price = "Enter a price, e.g. 150 or 150.00.";

  const status = (text("status") || "pending") as AppointmentStatus;
  if (!appointmentStatuses.includes(status)) errors.status = "Choose a status.";

  return {
    values: {
      customerId: customerId!,
      propertyId: propertyId!,
      vehicleId: vehicleId!,
      // wall-clock times in the business's time zone, converted by Postgres
      // (which knows the daylight-saving rules)
      scheduledStart: sql`(${`${date} ${start}`}::timestamp at time zone ${TIME_ZONE})`,
      scheduledEnd: sql`(${`${date} ${end}`}::timestamp at time zone ${TIME_ZONE})`,
      priceCents: priceCents!,
      status,
      notes: text("notes") || null,
    },
    errors,
    hasErrors: Object.keys(errors).length > 0,
  };
}

// Checks against the database that the form can't make: the property belongs
// to the customer, and the vehicle is in service. Skipped for values that
// haven't changed, so an old appointment stays editable after its property is
// transferred or its vehicle retired.
async function checkReferences(
  v: { customerId: number; propertyId: number; vehicleId: number },
  current?: { customerId: number; propertyId: number; vehicleId: number | null },
) {
  const errors: NonNullable<AppointmentFormState["errors"]> = {};
  const [property, vehicle] = await Promise.all([
    db.query.properties.findFirst({ columns: { customerId: true }, where: eq(properties.id, v.propertyId) }),
    db.query.vehicles.findFirst({ columns: { isActive: true }, where: eq(vehicles.id, v.vehicleId) }),
  ]);
  const placeChanged = !current || current.customerId !== v.customerId || current.propertyId !== v.propertyId;
  if (!property) errors.propertyId = "That property no longer exists.";
  else if (placeChanged && property.customerId !== v.customerId)
    errors.propertyId = "That property doesn't belong to this customer.";
  if (!vehicle) errors.vehicleId = "That vehicle no longer exists.";
  else if (!vehicle.isActive && current?.vehicleId !== v.vehicleId)
    errors.vehicleId = "That vehicle is out of service.";
  return errors;
}

// The open service plan at the property, if any.
async function planFor(propertyId: number) {
  const plan = await db.query.servicePlans.findFirst({
    columns: { id: true },
    where: and(eq(servicePlans.propertyId, propertyId), isNull(servicePlans.endDate)),
  });
  return plan?.id ?? null;
}

// Turns a refused double booking into a message naming the clash.
async function overlapMessage(
  vehicleId: number,
  start: ReturnType<typeof sql>,
  end: ReturnType<typeof sql>,
  selfId?: number,
) {
  const [clash] = await db
    .select({
      id: appointments.id,
      scheduledStart: appointments.scheduledStart,
      scheduledEnd: appointments.scheduledEnd,
      vehicleName: vehicles.name,
      firstName: customers.firstName,
      lastName: customers.lastName,
      companyName: customers.companyName,
    })
    .from(appointments)
    .innerJoin(customers, eq(customers.id, appointments.customerId))
    .innerJoin(vehicles, eq(vehicles.id, appointments.vehicleId))
    .where(
      and(
        eq(appointments.vehicleId, vehicleId),
        ne(appointments.status, "canceled"),
        selfId ? ne(appointments.id, selfId) : undefined,
        sql`tstzrange(${appointments.scheduledStart}, ${appointments.scheduledEnd}) && tstzrange(${start}, ${end})`,
      ),
    )
    .limit(1);
  if (!clash) return "That vehicle is already booked at this time.";
  return `${clash.vehicleName} is already booked ${formatTimeRange(clash.scheduledStart, clash.scheduledEnd)} for ${displayName(clash)}.`;
}

async function dbErrorState(
  err: unknown,
  values: ReturnType<typeof parse>["values"],
  selfId?: number,
): Promise<AppointmentFormState> {
  const pg = pgError(err);
  if (pg?.code === "23P01" && pg.constraint === "appointments_vehicle_no_overlap")
    return {
      errors: {
        vehicleId: await overlapMessage(values.vehicleId, values.scheduledStart, values.scheduledEnd, selfId),
      },
    };
  if (pg?.code === "23514" && pg.constraint === "appointments_end_after_start_check")
    return { errors: { end: "End time must be after the start time." } };
  if (pg?.code === "23503") return { message: "The customer, property or vehicle no longer exists." };
  console.error("appointment save failed", err);
  return { message: "Couldn't save the appointment. Please try again." };
}

export async function createAppointment(
  _prev: AppointmentFormState,
  formData: FormData,
): Promise<AppointmentFormState> {
  const user = await requireUser();
  const { values, errors, hasErrors } = parse(formData);
  if (hasErrors) return { errors };
  const refErrors = await checkReferences(values);
  if (Object.keys(refErrors).length > 0) return { errors: refErrors };

  let id: number;
  try {
    const [, inserted] = await db.batch([
      asUser(user.id),
      db
        .insert(appointments)
        .values({ ...values, servicePlanId: await planFor(values.propertyId) })
        .returning({ id: appointments.id }),
    ]);
    id = inserted[0].id;
  } catch (err) {
    return dbErrorState(err, values);
  }

  redirect(`/appointments/${id}?saved=created`);
}

export async function updateAppointment(
  id: number,
  _prev: AppointmentFormState,
  formData: FormData,
): Promise<AppointmentFormState> {
  const user = await requireUser();
  const { values, errors, hasErrors } = parse(formData);
  if (hasErrors) return { errors };

  const current = await db.query.appointments.findFirst({
    columns: { customerId: true, propertyId: true, vehicleId: true, servicePlanId: true },
    where: eq(appointments.id, id),
  });
  if (!current) return { message: "This appointment no longer exists." };
  const refErrors = await checkReferences(values, current);
  if (Object.keys(refErrors).length > 0) return { errors: refErrors };

  const servicePlanId =
    current.propertyId === values.propertyId ? current.servicePlanId : await planFor(values.propertyId);

  try {
    await db.batch([
      asUser(user.id),
      db.update(appointments).set({ ...values, servicePlanId }).where(eq(appointments.id, id)),
    ]);
  } catch (err) {
    return dbErrorState(err, values, id);
  }

  redirect(`/appointments/${id}?saved=updated`);
}

export type StatusActionState = { message?: string };

// The Complete / Cancel / Reopen buttons on an appointment.
export async function setAppointmentStatus(
  id: number,
  status: AppointmentStatus,
): Promise<StatusActionState> {
  const user = await requireUser();
  if (!appointmentStatuses.includes(status)) return { message: "Unknown status." };

  try {
    await db.batch([
      asUser(user.id),
      db.update(appointments).set({ status }).where(eq(appointments.id, id)),
    ]);
  } catch (err) {
    const pg = pgError(err);
    // reopening a canceled appointment whose slot has since been taken
    if (pg?.code === "23P01")
      return { message: "Can't reopen it: the vehicle has since been booked at this time. Edit the time or vehicle first." };
    console.error("appointment status change failed", err);
    return { message: "Couldn't change the status. Please try again." };
  }

  redirect(`/appointments/${id}?saved=${status}`);
}

export type DeleteActionState = { message?: string };

// Permanently removes an appointment. The audit log keeps a copy of the row
// and who deleted it. Appointments with payments can't be deleted: the
// payment would lose its link, so cancel those instead.
export async function deleteAppointment(id: number): Promise<DeleteActionState> {
  const user = await requireUser();
  const current = await db.query.appointments.findFirst({
    columns: { scheduledStart: true },
    where: eq(appointments.id, id),
  });
  if (!current) return { message: "This appointment no longer exists." };

  const [{ paymentCount }] = await db
    .select({ paymentCount: sql<number>`count(*)::int` })
    .from(payments)
    .where(eq(payments.appointmentId, id));
  if (paymentCount > 0)
    return {
      message: `It has ${paymentCount === 1 ? "a payment" : `${paymentCount} payments`} recorded against it, so it can't be deleted. Cancel it instead.`,
    };

  try {
    await db.batch([
      asUser(user.id),
      // GPS stops matched to it just lose the match
      db.update(gpsStops).set({ appointmentId: null }).where(eq(gpsStops.appointmentId, id)),
      db.delete(appointments).where(eq(appointments.id, id)),
    ]);
  } catch (err) {
    const pg = pgError(err);
    if (pg?.code === "23503")
      return { message: "Other records (such as payments) still point to it, so it can't be deleted. Cancel it instead." };
    console.error("appointment delete failed", err);
    return { message: "Couldn't delete the appointment. Please try again." };
  }

  redirect(`/appointments?view=week&date=${toLocalInputs(current.scheduledStart).date}&deleted=1`);
}
