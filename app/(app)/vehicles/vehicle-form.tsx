"use client";

import Link from "next/link";
import { startTransition, useActionState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { VehicleField, VehicleFormState } from "./actions";

const fields: { name: VehicleField; label: string; hint?: string; required?: boolean }[] = [
  { name: "name", label: "Name", hint: "What the team calls it, e.g. Van 1 or White Transit.", required: true },
  { name: "plate", label: "License plate" },
  { name: "gpsName", label: "GPS tracker name", hint: "As it appears in GPS exports, so trips can be matched later." },
];

export function VehicleForm({
  mode,
  action,
  initialValues,
}: {
  mode: "create" | "edit";
  action: (prev: VehicleFormState, formData: FormData) => Promise<VehicleFormState>;
  initialValues: { name: string; plate: string; gpsName: string; isActive: boolean };
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const errors = state.errors ?? {};

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 grid gap-5" noValidate>
      {state.message && (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.message}
        </p>
      )}
      {fields.map(({ name, label, hint, required }) => (
        <div key={name} className="grid gap-1.5">
          <Label htmlFor={name}>
            {label}
            {required && <span aria-hidden="true">*</span>}
          </Label>
          <Input
            id={name}
            name={name}
            defaultValue={initialValues[name]}
            autoComplete="off"
            aria-invalid={errors[name] ? true : undefined}
            aria-describedby={errors[name] ? `${name}-error` : undefined}
            className={name === "plate" ? "uppercase" : undefined}
          />
          {errors[name] ? (
            <p id={`${name}-error`} className="text-[0.8rem] text-destructive">{errors[name]}</p>
          ) : (
            hint && <p className="text-[0.8rem] text-muted-foreground">{hint}</p>
          )}
        </div>
      ))}
      {mode === "edit" && (
        <label className="flex items-start gap-2.5 text-sm">
          <input type="checkbox" name="isActive" defaultChecked={initialValues.isActive} className="mt-0.5 size-4 accent-primary" />
          <span>
            In service
            <span className="block text-[0.8rem] text-muted-foreground">
              Untick to stop offering it for new appointments. Existing appointments keep it.
            </span>
          </span>
        </label>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : mode === "create" ? "Add vehicle" : "Save changes"}
        </Button>
        <Link href="/vehicles" className={buttonVariants({ variant: "outline" })}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
