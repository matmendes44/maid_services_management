// Shared by server and client code, so only *types* come from the schema —
// the label records below fail to compile if a DB enum value is missing.
import type { customers } from "@/db/schema";

type Customer = typeof customers.$inferSelect;
export type CustomerType = Customer["type"];
export type CustomerStatus = Customer["status"];
export type EndReason = Customer["endReasons"][number];

export const typeLabels: Record<CustomerType, string> = {
  residential: "Residential",
  commercial: "Commercial",
  referral_partner: "Referral partner",
};

export const statusLabels: Record<CustomerStatus, string> = {
  lead: "Lead",
  active: "Active",
  paused: "Paused",
  inactive: "Inactive",
};

export const endReasonLabels: Record<EndReason, string> = {
  quality: "Quality issues",
  scheduling_communication: "Scheduling / communication issues",
  client_circumstances: "Client circumstances",
};

export const customerTypes = Object.keys(typeLabels) as CustomerType[];
export const customerStatuses = Object.keys(statusLabels) as CustomerStatus[];
export const endReasons = Object.keys(endReasonLabels) as EndReason[];

// Date-only columns come back as "YYYY-MM-DD". Formatting in UTC keeps them
// from shifting a day when converted to a local timezone.
const dayFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });
export function formatDay(value: string) {
  return dayFormat.format(new Date(`${value}T00:00:00Z`));
}

export function todayISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
}

// Editable customer columns, in form order, with their display labels.
export const fieldLabels = {
  customerCode: "Customer code",
  type: "Type",
  status: "Status",
  startDate: "Start date",
  endDate: "End date",
  endReasons: "Reasons for leaving",
  firstName: "First name",
  lastName: "Last name",
  companyName: "Company name",
  email: "Email",
  referredById: "Referred by",
  billingPropertyId: "Billing address",
  stripeCustomerId: "Stripe customer ID",
  notes: "Notes",
} as const;

export type CustomerField = keyof typeof fieldLabels;

// Field names of the first property on the new-customer form.
export const FIRST_PROPERTY_PREFIX = "property_";
export type CustomerFormValues = Record<CustomerField, string>;

// Turns submitted form data into trimmed strings. The server validates these,
// and the edit form uses the same function to work out what changed.
export function normalizeCustomerForm(formData: FormData): CustomerFormValues {
  const get = (field: CustomerField) => {
    const value = formData.get(field);
    return typeof value === "string" ? value.trim() : "";
  };
  return {
    customerCode: get("customerCode").toUpperCase(),
    type: get("type"),
    status: get("status"),
    startDate: get("startDate"),
    endDate: get("endDate"),
    // checkbox group; kept in canonical order so edits compare reliably
    endReasons: endReasons
      .filter((r) => formData.getAll("endReasons").includes(r))
      .join(","),
    firstName: get("firstName"),
    lastName: get("lastName"),
    companyName: get("companyName"),
    email: get("email").toLowerCase(),
    referredById: get("referredById"),
    billingPropertyId: get("billingPropertyId"),
    stripeCustomerId: get("stripeCustomerId"),
    notes: get("notes"),
  };
}

// The inverse: a DB row as the strings the form works with.
export function customerToFormValues(c: Customer): CustomerFormValues {
  return {
    customerCode: c.customerCode,
    type: c.type,
    status: c.status,
    startDate: c.startDate,
    endDate: c.endDate ?? "",
    endReasons: endReasons.filter((r) => c.endReasons.includes(r)).join(","),
    firstName: c.firstName ?? "",
    lastName: c.lastName ?? "",
    companyName: c.companyName ?? "",
    email: c.email ?? "",
    referredById: c.referredById?.toString() ?? "",
    billingPropertyId: c.billingPropertyId?.toString() ?? "",
    stripeCustomerId: c.stripeCustomerId ?? "",
    notes: c.notes ?? "",
  };
}

export function displayName(c: {
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
}) {
  const person = [c.firstName, c.lastName].filter(Boolean).join(" ");
  return person || c.companyName || "—";
}

// US phone numbers are stored as +1XXXXXXXXXX. Returns null if the input
// isn't a 10-digit US number (an optional leading 1 is allowed).
export function normalizePhone(input: string) {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

// "+14435405530" → "(443) 540-5530"; anything else is shown as stored.
export function formatPhone(phone: string) {
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(phone);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : phone;
}
