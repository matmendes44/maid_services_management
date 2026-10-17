// Shared by server and client code, so only *types* come from the schema.
import type { properties } from "@/db/schema";

type Property = typeof properties.$inferSelect;
export type ServiceZone = NonNullable<Property["zone"]>;

export const zoneLabels: Record<ServiceZone, string> = {
  south: "South",
  northwest: "Northwest",
  city_core: "City core",
  north_northeast: "North / Northeast",
  other: "Other",
};
export const zones = Object.keys(zoneLabels) as ServiceZone[];

export function formatAddress(p: {
  street: string;
  unit: string | null;
  city: string;
  state: string;
  zip: string;
}) {
  return `${p.street}${p.unit ? `, ${p.unit}` : ""}, ${p.city}, ${p.state} ${p.zip}`;
}

// Address fields, shared by the property form and the first property on the
// new-customer form (where they're prefixed so they don't clash).
export const addressLabels = {
  street: "Street address",
  unit: "Apt / unit",
  city: "City",
  state: "State",
  zip: "ZIP",
  zone: "Service zone",
} as const;

export type AddressField = keyof typeof addressLabels;
export type AddressValues = Record<AddressField, string>;
export type AddressErrors = Partial<Record<AddressField, string>>;

export function readAddress(formData: FormData, prefix = ""): AddressValues {
  const get = (field: AddressField) => {
    const value = formData.get(prefix + field);
    return typeof value === "string" ? value.trim() : "";
  };
  return {
    street: get("street"),
    unit: get("unit"),
    city: get("city"),
    state: get("state").toUpperCase(),
    zip: get("zip"),
    zone: get("zone"),
  };
}

export function isAddressBlank(v: AddressValues) {
  return !v.street && !v.unit && !v.city && !v.zip;
}

// Mirrors the properties table: street, city and a 5-digit ZIP are required.
export function validateAddress(v: AddressValues): AddressErrors {
  const errors: AddressErrors = {};
  if (!v.street) errors.street = "Street address is required.";
  if (!v.city) errors.city = "City is required.";
  if (!/^[A-Z]{2}$/.test(v.state)) errors.state = "Use the 2-letter state code.";
  if (!/^\d{5}$/.test(v.zip)) errors.zip = "Enter a 5-digit ZIP code.";
  if (v.zone && !zones.includes(v.zone as ServiceZone)) errors.zone = "Choose a zone from the list.";
  return errors;
}

export function addressToRow(v: AddressValues) {
  return {
    street: v.street,
    unit: v.unit || null,
    city: v.city,
    state: v.state,
    zip: v.zip,
    zone: (v.zone || null) as ServiceZone | null,
  };
}
