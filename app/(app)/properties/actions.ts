"use server";

import { and, eq, isNull, ne, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { customers, properties } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { nextId, pgError } from "@/lib/db-helpers";
import { addressToRow, readAddress, validateAddress, type AddressField } from "./options";

export type PropertyField = AddressField | "customerId" | "accessNotes" | "serviceNotes";

export type PropertyFormState = {
  errors?: Partial<Record<PropertyField, string>>;
  message?: string;
};

function parse(formData: FormData) {
  const text = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value.trim() : "";
  };
  const address = readAddress(formData);
  const errors: NonNullable<PropertyFormState["errors"]> = validateAddress(address);

  const customerId = Number(text("customerId"));
  if (!text("customerId") || !Number.isSafeInteger(customerId))
    errors.customerId = "Choose the customer this property belongs to.";

  return {
    customerId,
    row: {
      ...addressToRow(address),
      accessNotes: text("accessNotes") || null,
      serviceNotes: text("serviceNotes") || null,
    },
    // unchecked checkboxes aren't submitted
    isActive: formData.get("isActive") !== null,
    makeBilling: formData.get("billing") !== null,
    errors,
    hasErrors: Object.keys(errors).length > 0,
  };
}

function dbErrorState(err: unknown): PropertyFormState {
  const pg = pgError(err);
  if (pg?.code === "23503" && pg.constraint === "properties_customer_id_fkey")
    return { errors: { customerId: "That customer no longer exists." } };
  if (pg?.code === "23514" && pg.constraint === "properties_zip_check")
    return { errors: { zip: "Enter a 5-digit ZIP code." } };
  console.error("property save failed", err);
  return { message: "Couldn't save the property. Please try again." };
}

// Billing address of `customerId` becomes `propertyId` when asked, or when the
// customer doesn't have one yet (so a customer's first property is the default).
function setBilling(customerId: number, propertyId: number, force: boolean) {
  return db
    .update(customers)
    .set({ billingPropertyId: propertyId })
    .where(
      and(
        eq(customers.id, customerId),
        force ? undefined : isNull(customers.billingPropertyId),
      ),
    );
}

export async function createProperty(
  _prev: PropertyFormState,
  formData: FormData,
): Promise<PropertyFormState> {
  await requireUser();
  const { customerId, row, makeBilling, errors, hasErrors } = parse(formData);
  if (hasErrors) return { errors };

  try {
    const id = await nextId("properties");
    await db.batch([
      db.insert(properties).values({ ...row, id, customerId }),
      setBilling(customerId, id, makeBilling),
    ]);
  } catch (err) {
    return dbErrorState(err);
  }

  redirect(`/customers/${customerId}?saved=property`);
}

export async function updateProperty(
  id: number,
  _prev: PropertyFormState,
  formData: FormData,
): Promise<PropertyFormState> {
  await requireUser();
  const { customerId, row, isActive, makeBilling, errors, hasErrors } = parse(formData);
  if (hasErrors) return { errors };

  const current = await db.query.properties.findFirst({
    columns: { customerId: true },
    where: eq(properties.id, id),
  });
  if (!current) return { message: "This property no longer exists." };
  const previousCustomerId = current.customerId;
  const moved = previousCustomerId !== customerId;

  // All in one transaction, in this order:
  const statements: [BatchItem<"pg">, ...BatchItem<"pg">[]] = [
    // 1. Stop this property being anyone's billing address, except the
    //    (new) customer's when it's staying their billing address. The
    //    foreign key wouldn't allow the move otherwise.
    db
      .update(customers)
      .set({ billingPropertyId: null })
      .where(
        and(
          eq(customers.billingPropertyId, id),
          makeBilling ? ne(customers.id, customerId) : undefined,
        ),
      ),
    // 2. Save the property, possibly under its new customer.
    db.update(properties).set({ ...row, customerId, isActive }).where(eq(properties.id, id)),
  ];

  // 3. Billing address for the (new) customer: when the box is ticked, or
  //    after a transfer to a customer who has none yet. Unticking on the same
  //    customer leaves it cleared.
  if (makeBilling || moved) statements.push(setBilling(customerId, id, makeBilling));

  // 4. After a transfer, the previous customer falls back to their next
  //    property if this one was their billing address.
  if (moved) {
    statements.push(
      db
        .update(customers)
        .set({
          billingPropertyId: sql`(
            select ${properties.id} from ${properties}
             where ${properties.customerId} = ${previousCustomerId}
             order by ${properties.isActive} desc, ${properties.id}
             limit 1)`,
        })
        .where(and(eq(customers.id, previousCustomerId), isNull(customers.billingPropertyId))),
    );
  }

  try {
    await db.batch(statements);
  } catch (err) {
    return dbErrorState(err);
  }

  redirect(`/customers/${customerId}?saved=property`);
}
