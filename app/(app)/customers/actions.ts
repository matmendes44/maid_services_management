"use server";

import { eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { requireUser } from "@/lib/auth/session";
import { customers } from "@/db/schema";
import {
  customerStatuses,
  customerTypes,
  endReasons,
  normalizeCustomerForm,
  type CustomerField,
  type CustomerStatus,
  type CustomerType,
  type EndReason,
} from "./options";

export type CustomerFormState = {
  errors?: Partial<Record<CustomerField, string>>;
  message?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value);
}

// `previousStatus` is the customer's status before this edit (undefined when
// creating). Reasons for leaving are required when a customer is *set* to
// inactive; customers who were already inactive before reasons existed can be
// edited without inventing one.
function parse(
  formData: FormData,
  { selfId, previousStatus }: { selfId?: number; previousStatus?: CustomerStatus } = {},
) {
  const values = normalizeCustomerForm(formData);
  const errors: NonNullable<CustomerFormState["errors"]> = {};

  if (!values.customerCode) errors.customerCode = "Customer code is required.";
  else if (/\s/.test(values.customerCode))
    errors.customerCode = "Customer code can't contain spaces.";

  if (!customerTypes.includes(values.type as CustomerType))
    errors.type = "Choose a customer type.";
  if (!customerStatuses.includes(values.status as CustomerStatus))
    errors.status = "Choose a status.";

  if (!values.startDate) errors.startDate = "Start date is required.";
  else if (!isValidDate(values.startDate)) errors.startDate = "Enter a valid date.";

  const inactive = values.status === "inactive";
  const reasons = values.endReasons ? (values.endReasons.split(",") as EndReason[]) : [];
  if (inactive) {
    if (!values.endDate) errors.endDate = "Inactive customers need an end date.";
    else if (!isValidDate(values.endDate)) errors.endDate = "Enter a valid date.";
    // ISO dates compare correctly as strings
    else if (values.startDate && values.endDate < values.startDate)
      errors.endDate = "End date can't be before the start date.";

    if (reasons.some((r) => !endReasons.includes(r)))
      errors.endReasons = "Choose reasons from the list.";
    else if (reasons.length === 0 && previousStatus !== "inactive")
      errors.endReasons = "Choose at least one reason for leaving.";
  }

  // mirrors the customers_check constraint in the database
  if (!values.firstName && !values.companyName)
    errors.firstName = "Enter a first name or a company name.";

  if (values.email && !EMAIL_RE.test(values.email))
    errors.email = "Enter a valid email address.";

  const referredById = values.referredById ? Number(values.referredById) : null;
  if (referredById !== null && !Number.isSafeInteger(referredById))
    errors.referredById = "Choose a customer from the list.";
  else if (referredById !== null && referredById === selfId)
    errors.referredById = "A customer can't refer themselves.";

  if (values.stripeCustomerId && !values.stripeCustomerId.startsWith("cus_"))
    errors.stripeCustomerId = 'Stripe customer IDs start with "cus_".';

  const data = {
    customerCode: values.customerCode,
    type: values.type as CustomerType,
    status: values.status as CustomerStatus,
    startDate: values.startDate,
    // only inactive customers have an end date or reasons (enforced in the DB)
    endDate: inactive ? values.endDate : null,
    endReasons: inactive ? reasons : [],
    firstName: values.firstName || null,
    lastName: values.lastName || null,
    companyName: values.companyName || null,
    email: values.email || null,
    referredById,
    stripeCustomerId: values.stripeCustomerId || null,
    notes: values.notes || null,
  };

  return { data, errors, hasErrors: Object.keys(errors).length > 0 };
}

// Postgres errors arrive wrapped (DrizzleQueryError → NeonDbError); walk the
// cause chain to find the one carrying the SQLSTATE code.
function pgError(err: unknown): { code?: string; constraint?: string } | null {
  let current: unknown = err;
  while (current && typeof current === "object") {
    if ("code" in current && typeof current.code === "string") {
      return current as { code: string; constraint?: string };
    }
    current = (current as { cause?: unknown }).cause;
  }
  return null;
}

function dbErrorState(err: unknown, customerCode: string): CustomerFormState {
  const pg = pgError(err);
  if (pg?.code === "23505" && pg.constraint === "customers_customer_code_key")
    return { errors: { customerCode: `${customerCode} is already in use.` } };
  if (pg?.code === "23505" && pg.constraint === "customers_stripe_customer_id_key")
    return { errors: { stripeCustomerId: "Another customer already has this Stripe ID." } };
  if (pg?.code === "23503")
    return { errors: { referredById: "That referring customer no longer exists." } };
  if (pg?.code === "23514" && pg.constraint === "customers_end_after_start_check")
    return { errors: { endDate: "End date can't be before the start date." } };
  console.error("customer save failed", err);
  return { message: "Couldn't save the customer. Please try again." };
}

export async function createCustomer(
  _prev: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  await requireUser();
  const { data, errors, hasErrors } = parse(formData);
  if (hasErrors) return { errors };

  let id: number;
  try {
    [{ id }] = await db.insert(customers).values(data).returning({ id: customers.id });
  } catch (err) {
    return dbErrorState(err, data.customerCode);
  }

  redirect(`/customers/${id}?saved=created`);
}

export async function updateCustomer(
  id: number,
  _prev: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  await requireUser();
  const current = await db.query.customers.findFirst({
    columns: { status: true },
    where: eq(customers.id, id),
  });
  if (!current) return { message: "This customer no longer exists." };

  const { data, errors, hasErrors } = parse(formData, {
    selfId: id,
    previousStatus: current.status,
  });
  if (hasErrors) return { errors };

  try {
    const updated = await db
      .update(customers)
      .set({ ...data, updatedAt: sql`now()` })
      .where(eq(customers.id, id))
      .returning({ id: customers.id });
    if (updated.length === 0) return { message: "This customer no longer exists." };
  } catch (err) {
    return dbErrorState(err, data.customerCode);
  }

  redirect(`/customers/${id}?saved=updated`);
}
