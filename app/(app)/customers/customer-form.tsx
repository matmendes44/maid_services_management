"use client";

import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { AddressFields } from "../properties/address-fields";
import type { CustomerFormState } from "./actions";
import {
  customerStatuses,
  customerTypes,
  endReasonLabels,
  endReasons,
  FIRST_PROPERTY_PREFIX,
  fieldLabels,
  formatDay,
  normalizeCustomerForm,
  statusLabels,
  typeLabels,
  type CustomerField,
  type CustomerFormValues,
  type CustomerStatus,
  type CustomerType,
  type EndReason,
} from "./options";

type Change = { field: CustomerField; from: string; to: string };

function Field({
  name,
  required,
  hint,
  error,
  className,
  children,
}: {
  name: CustomerField;
  required?: boolean;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className ?? "grid gap-1.5"}>
      <Label htmlFor={name}>
        {fieldLabels[name]}
        {required && <span aria-hidden="true">*</span>}
      </Label>
      {children}
      {error ? (
        <p id={`${name}-error`} className="text-[0.8rem] text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[0.8rem] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function CustomerForm({
  mode,
  action,
  initialValues,
  referrers,
  properties = [],
  cancelHref,
}: {
  mode: "create" | "edit";
  action: (prev: CustomerFormState, formData: FormData) => Promise<CustomerFormState>;
  initialValues: CustomerFormValues;
  referrers: { id: number; label: string }[];
  // the customer's properties, to choose a billing address from (edit only)
  properties?: { id: number; label: string }[];
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [confirming, setConfirming] = useState<{ formData: FormData; changes: Change[] } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Controlled so the inactive fields can appear as soon as it's selected.
  const [status, setStatus] = useState(initialValues.status);
  const errors = state.errors ?? {};
  const initialReasons = initialValues.endReasons.split(",");
  // Mirrors the server rule: reasons are required when a customer is *set* to inactive.
  const reasonsRequired = mode === "create" || initialValues.status !== "inactive";

  const referrerLabels = new Map(referrers.map((r) => [String(r.id), r.label]));
  const propertyLabels = new Map(properties.map((p) => [String(p.id), p.label]));
  const display = (field: CustomerField, value: string) => {
    if (!value) return "(empty)";
    if (field === "type") return typeLabels[value as CustomerType] ?? value;
    if (field === "status") return statusLabels[value as CustomerStatus] ?? value;
    if (field === "referredById") return referrerLabels.get(value) ?? `#${value}`;
    if (field === "billingPropertyId") return propertyLabels.get(value) ?? `#${value}`;
    if (field === "startDate" || field === "endDate") return formatDay(value);
    if (field === "endReasons")
      return value
        .split(",")
        .map((r) => endReasonLabels[r as EndReason] ?? r)
        .join(", ");
    return value;
  };

  // The form is submitted by hand rather than through `action=` so that React
  // doesn't reset the inputs, and so edits can be confirmed before saving.
  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    const formData = new FormData(event.currentTarget);

    if (mode === "create") {
      startTransition(() => formAction(formData));
      return;
    }

    const next = normalizeCustomerForm(formData);
    const changes = (Object.keys(fieldLabels) as CustomerField[])
      .filter((field) => next[field] !== initialValues[field])
      .map((field) => ({ field, from: initialValues[field], to: next[field] }));

    if (changes.length === 0) {
      setNotice("Nothing has changed yet.");
      return;
    }
    setConfirming({ formData, changes });
  }

  function confirm() {
    if (!confirming) return;
    const { formData } = confirming;
    setConfirming(null);
    startTransition(() => formAction(formData));
  }

  const field = (name: CustomerField) => ({
    id: name,
    name,
    defaultValue: initialValues[name],
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
  });

  return (
    <>
      <form onSubmit={onSubmit} className="mt-6 grid gap-6" noValidate>
        {state.message && (
          <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.message}
          </p>
        )}

        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-3 text-base font-semibold">Account</legend>
          <Field
            name="customerCode"
            required
            error={errors.customerCode}
            hint={mode === "create" ? "Next available code" : undefined}
          >
            <Input {...field("customerCode")} required autoComplete="off" className="font-mono" />
          </Field>
          <Field name="type" required error={errors.type}>
            <NativeSelect {...field("type")} className="w-full">
              {customerTypes.map((t) => (
                <NativeSelectOption key={t} value={t}>{typeLabels[t]}</NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field name="status" required error={errors.status}>
            <NativeSelect
              {...field("status")}
              defaultValue={undefined}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full"
            >
              {customerStatuses.map((s) => (
                <NativeSelectOption key={s} value={s}>{statusLabels[s]}</NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field name="startDate" required error={errors.startDate}>
            <Input {...field("startDate")} type="date" required />
          </Field>
        </fieldset>

        {status === "inactive" && (
          <fieldset className="grid gap-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 sm:grid-cols-2">
            <legend className="px-1 text-sm font-semibold">Inactive</legend>
            <Field name="endDate" required error={errors.endDate}>
              <Input {...field("endDate")} type="date" required />
            </Field>
            <fieldset
              className="grid gap-2 sm:col-span-2"
              aria-invalid={errors.endReasons ? true : undefined}
              aria-describedby={errors.endReasons ? "endReasons-error" : undefined}
            >
              <legend className="mb-1.5 text-sm font-medium">
                {fieldLabels.endReasons}
                {reasonsRequired && <span aria-hidden="true">*</span>}
              </legend>
              {endReasons.map((r) => (
                <label key={r} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="endReasons"
                    value={r}
                    defaultChecked={initialReasons.includes(r)}
                    className="size-4 accent-primary"
                  />
                  {endReasonLabels[r]}
                </label>
              ))}
              {errors.endReasons ? (
                <p id="endReasons-error" className="text-[0.8rem] text-destructive">{errors.endReasons}</p>
              ) : (
                <p className="text-[0.8rem] text-muted-foreground">
                  {reasonsRequired
                    ? "Choose at least one."
                    : "Optional for customers who were already inactive."}
                </p>
              )}
            </fieldset>
          </fieldset>
        )}

        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-3 text-base font-semibold">Name</legend>
          <Field name="firstName" error={errors.firstName}>
            <Input {...field("firstName")} autoComplete="off" autoFocus={mode === "create"} />
          </Field>
          <Field name="lastName" error={errors.lastName}>
            <Input {...field("lastName")} autoComplete="off" />
          </Field>
          <Field
            name="companyName"
            hint="For commercial customers. Required if there's no first name."
            error={errors.companyName}
            className="grid gap-1.5 sm:col-span-2"
          >
            <Input {...field("companyName")} autoComplete="off" />
          </Field>
        </fieldset>

        {mode === "create" && (
          <fieldset>
            <legend className="mb-1 text-base font-semibold">Service address</legend>
            <p className="mb-3 text-[0.8rem] text-muted-foreground">
              Optional. The first property you enter becomes the customer&apos;s billing address.
            </p>
            <AddressFields
              prefix={FIRST_PROPERTY_PREFIX}
              errors={state.propertyErrors}
              required={false}
            />
          </fieldset>
        )}

        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-3 text-base font-semibold">Details</legend>
          <Field name="email" error={errors.email} className="grid gap-1.5 sm:col-span-2">
            <Input {...field("email")} type="email" autoComplete="off" />
          </Field>
          <Field name="referredById" error={errors.referredById}>
            <NativeSelect {...field("referredById")} className="w-full">
              <NativeSelectOption value="">No referral</NativeSelectOption>
              {referrers.map((r) => (
                <NativeSelectOption key={r.id} value={r.id}>{r.label}</NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          {mode === "edit" && (
            <Field
              name="billingPropertyId"
              hint={
                properties.length === 0
                  ? "Add a property to this customer to set a billing address."
                  : "Choose which of the customer's properties to bill to."
              }
              error={errors.billingPropertyId}
              className="grid gap-1.5 sm:col-span-2"
            >
              <NativeSelect
                {...field("billingPropertyId")}
                className="w-full"
                disabled={properties.length === 0}
              >
                <NativeSelectOption value="">No billing address</NativeSelectOption>
                {properties.map((p) => (
                  <NativeSelectOption key={p.id} value={p.id}>{p.label}</NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          )}
          <Field name="stripeCustomerId" hint="Optional, e.g. cus_ABC123" error={errors.stripeCustomerId}>
            <Input {...field("stripeCustomerId")} autoComplete="off" className="font-mono" />
          </Field>
          <Field name="notes" error={errors.notes} className="grid gap-1.5 sm:col-span-2">
            <Textarea {...field("notes")} rows={4} />
          </Field>
        </fieldset>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : mode === "create" ? "Add customer" : "Save changes"}
          </Button>
          <Link href={cancelHref} className={buttonVariants({ variant: "outline" })}>
            Cancel
          </Link>
          {notice && (
            <p role="status" className="text-sm text-muted-foreground">
              {notice}
            </p>
          )}
        </div>
      </form>

      <AlertDialog open={confirming !== null} onOpenChange={(open) => !open && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm changes</AlertDialogTitle>
            <AlertDialogDescription>
              {confirming?.changes.length === 1
                ? "You're about to change 1 field."
                : `You're about to change ${confirming?.changes.length} fields.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <dl className="grid max-h-80 gap-3 overflow-y-auto text-sm">
            {confirming?.changes.map(({ field, from, to }) => (
              <div key={field}>
                <dt className="font-medium">{fieldLabels[field]}</dt>
                <dd className="mt-0.5 grid gap-0.5 break-words">
                  <span className="text-muted-foreground line-through">{display(field, from)}</span>
                  <span>{display(field, to)}</span>
                </dd>
              </div>
            ))}
          </dl>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={confirm}>Confirm changes</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
