"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { vehicles } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { pgError } from "@/lib/db-helpers";

export type VehicleField = "name" | "plate" | "gpsName";
export type VehicleFormState = { errors?: Partial<Record<VehicleField, string>>; message?: string };

function parse(formData: FormData) {
  const text = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value.trim() : "";
  };
  const values = {
    name: text("name"),
    plate: text("plate").toUpperCase() || null,
    gpsName: text("gpsName") || null,
    isActive: formData.get("isActive") !== null,
  };
  const errors: NonNullable<VehicleFormState["errors"]> = {};
  if (!values.name) errors.name = "Give the vehicle a name, e.g. Van 1.";
  return { values, errors, hasErrors: Object.keys(errors).length > 0 };
}

function dbErrorState(err: unknown): VehicleFormState {
  const pg = pgError(err);
  if (pg?.code === "23505" && pg.constraint === "vehicles_name_key")
    return { errors: { name: "Another vehicle already has this name." } };
  if (pg?.code === "23505" && pg.constraint === "vehicles_gps_name_key")
    return { errors: { gpsName: "Another vehicle already uses this GPS name." } };
  console.error("vehicle save failed", err);
  return { message: "Couldn't save the vehicle. Please try again." };
}

export async function createVehicle(_prev: VehicleFormState, formData: FormData): Promise<VehicleFormState> {
  await requireUser();
  const { values, errors, hasErrors } = parse(formData);
  if (hasErrors) return { errors };
  try {
    // new vehicles start in service
    await db.insert(vehicles).values({ ...values, isActive: true });
  } catch (err) {
    return dbErrorState(err);
  }
  redirect("/vehicles?saved=created");
}

export async function updateVehicle(id: number, _prev: VehicleFormState, formData: FormData): Promise<VehicleFormState> {
  await requireUser();
  const { values, errors, hasErrors } = parse(formData);
  if (hasErrors) return { errors };
  try {
    await db.update(vehicles).set(values).where(eq(vehicles.id, id));
  } catch (err) {
    return dbErrorState(err);
  }
  redirect("/vehicles?saved=updated");
}
