"use client";

import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { CustomerPicker, type CustomerOption } from "../properties/customer-picker";
import type { AppointmentField, AppointmentFormState } from "./actions";
import { appointmentStatuses, statusLabels } from "./options";

export type BookingOptions = {
  customers: CustomerOption[];
  properties: { id: number; customerId: number; label: string; isBilling: boolean; planRateCents: number | null }[];
  vehicles: { id: number; label: string; isActive: boolean }[];
};

export type AppointmentFormValues = {
  customerId: string;
  propertyId: string;
  vehicleId: string;
  date: string;
  start: string;
  end: string;
  price: string;
  status: string;
  notes: string;
};

const centsToPrice = (cents: number) => (cents / 100).toFixed(2);

function addMinutes(time: string, minutes: number) {
  const [h, m] = time.split(":").map(Number);
  const total = Math.min(h * 60 + m + minutes, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function AppointmentForm({
  mode,
  action,
  options,
  initialValues,
  cancelHref,
}: {
  mode: "create" | "edit";
  action: (prev: AppointmentFormState, formData: FormData) => Promise<AppointmentFormState>;
  options: BookingOptions;
  initialValues: AppointmentFormValues;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const errors = state.errors ?? {};

  const [customer, setCustomer] = useState<CustomerOption | null>(
    options.customers.find((c) => String(c.id) === initialValues.customerId) ?? null,
  );
  const [propertyId, setPropertyId] = useState(initialValues.propertyId);
  const [start, setStart] = useState(initialValues.start);
  const [end, setEnd] = useState(initialValues.end);
  const [price, setPrice] = useState(initialValues.price);
  // Once someone types a price, choosing a property stops overwriting it.
  const [priceEdited, setPriceEdited] = useState(mode === "edit");

  // The chosen customer's properties, plus the appointment's own property on
  // edit (it may since have been transferred to someone else).
  const customerProperties = options.properties.filter(
    (p) => p.customerId === customer?.id || (mode === "edit" && String(p.id) === initialValues.propertyId),
  );
  // In-service vehicles, plus the one already on the appointment.
  const vehicleOptions = options.vehicles.filter(
    (v) => v.isActive || String(v.id) === initialValues.vehicleId,
  );

  function chooseProperty(id: string) {
    setPropertyId(id);
    const rate = options.properties.find((p) => String(p.id) === id)?.planRateCents;
    if (!priceEdited && rate != null) setPrice(centsToPrice(rate));
  }

  function chooseCustomer(next: CustomerOption | null) {
    setCustomer(next);
    // default to their billing address, else their first property
    const theirs = options.properties.filter((p) => p.customerId === next?.id);
    const preferred = theirs.find((p) => p.isBilling) ?? theirs[0];
    chooseProperty(preferred ? String(preferred.id) : "");
  }

  function changeStart(value: string) {
    setStart(value);
    // keep the end after the start, preserving a 2-hour default
    if (value && (!end || end <= value)) setEnd(addMinutes(value, 120));
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  const describe = (name: AppointmentField) => ({
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
  });
  const error = (name: AppointmentField) =>
    errors[name] && (
      <p id={`${name}-error`} className="text-[0.8rem] text-destructive">
        {errors[name]}
      </p>
    );

  return (
    <form onSubmit={onSubmit} className="mt-6 grid gap-6" noValidate>
      {state.message && (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.message}
        </p>
      )}

      <fieldset className="grid gap-4">
        <legend className="mb-3 text-base font-semibold">Customer and property</legend>
        <div className="grid gap-1.5">
          <Label htmlFor="customerId">
            Customer<span aria-hidden="true">*</span>
          </Label>
          <CustomerPicker
            id="customerId"
            name="customerId"
            customers={options.customers}
            value={customer}
            onChange={chooseCustomer}
            invalid={Boolean(errors.customerId)}
            describedBy={errors.customerId ? "customerId-error" : undefined}
          />
          {error("customerId")}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="propertyId">
            Property<span aria-hidden="true">*</span>
          </Label>
          <NativeSelect
            id="propertyId"
            name="propertyId"
            value={propertyId}
            onChange={(e) => chooseProperty(e.target.value)}
            disabled={!customer}
            className="w-full"
            {...describe("propertyId")}
          >
            <NativeSelectOption value="" disabled>
              {!customer
                ? "Choose a customer first"
                : customerProperties.length === 0
                  ? "This customer has no properties"
                  : "Choose a property…"}
            </NativeSelectOption>
            {customerProperties.map((p) => (
              <NativeSelectOption key={p.id} value={p.id}>
                {p.label}
                {p.isBilling ? " · billing address" : ""}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {error("propertyId")}
          {customer && customerProperties.length === 0 && (
            <p className="text-[0.8rem] text-muted-foreground">
              <Link href={`/properties/new?customer=${customer.id}`} className="text-link underline-offset-4 hover:underline">
                Add a property
              </Link>{" "}
              for this customer first.
            </p>
          )}
        </div>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-6">
        <legend className="mb-3 text-base font-semibold">Schedule</legend>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="date">
            Date<span aria-hidden="true">*</span>
          </Label>
          <Input id="date" name="date" type="date" defaultValue={initialValues.date} {...describe("date")} />
          {error("date")}
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="start">
            Start<span aria-hidden="true">*</span>
          </Label>
          <Input
            id="start"
            name="start"
            type="time"
            step={300}
            value={start}
            onChange={(e) => changeStart(e.target.value)}
            {...describe("start")}
          />
          {error("start")}
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="end">
            End<span aria-hidden="true">*</span>
          </Label>
          <Input
            id="end"
            name="end"
            type="time"
            step={300}
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            {...describe("end")}
          />
          {error("end")}
        </div>
        <div className="grid gap-1.5 sm:col-span-3">
          <Label htmlFor="vehicleId">
            Vehicle<span aria-hidden="true">*</span>
          </Label>
          <NativeSelect
            id="vehicleId"
            name="vehicleId"
            defaultValue={initialValues.vehicleId}
            className="w-full"
            {...describe("vehicleId")}
          >
            <NativeSelectOption value="" disabled>
              {vehicleOptions.length === 0 ? "No vehicles yet" : "Choose a vehicle…"}
            </NativeSelectOption>
            {vehicleOptions.map((v) => (
              <NativeSelectOption key={v.id} value={v.id}>{v.label}</NativeSelectOption>
            ))}
          </NativeSelect>
          {error("vehicleId")}
          {vehicleOptions.length === 0 && (
            <p className="text-[0.8rem] text-muted-foreground">
              <Link href="/vehicles/new" className="text-link underline-offset-4 hover:underline">
                Add a vehicle
              </Link>{" "}
              first.
            </p>
          )}
        </div>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-6">
        <legend className="mb-3 text-base font-semibold">Details</legend>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="price">
            Price<span aria-hidden="true">*</span>
          </Label>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">$</span>
            <Input
              id="price"
              name="price"
              inputMode="decimal"
              value={price}
              onChange={(e) => {
                setPrice(e.target.value);
                setPriceEdited(true);
              }}
              className="pl-6"
              {...describe("price")}
            />
          </div>
          {error("price") ?? (
            <p className="text-[0.8rem] text-muted-foreground">Filled in from the property&apos;s service plan.</p>
          )}
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="status">Status</Label>
          <NativeSelect id="status" name="status" defaultValue={initialValues.status} className="w-full" {...describe("status")}>
            {appointmentStatuses.map((s) => (
              <NativeSelectOption key={s} value={s}>{statusLabels[s]}</NativeSelectOption>
            ))}
          </NativeSelect>
          {error("status")}
        </div>
        <div className="grid gap-1.5 sm:col-span-6">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            name="notes"
            rows={3}
            defaultValue={initialValues.notes}
            placeholder="Anything the crew should know about this visit…"
          />
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : mode === "create" ? "Book appointment" : "Save changes"}
        </Button>
        <Link href={cancelHref} className={buttonVariants({ variant: "outline" })}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
