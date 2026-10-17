import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { today } from "@/lib/today";
import { createAppointment } from "../actions";
import { AppointmentForm } from "../appointment-form";
import { getBookingOptions } from "../data";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

async function NewAppointmentForm({ searchParams }: Pick<PageProps<"/appointments/new">, "searchParams">) {
  const params = await searchParams;
  const [options, todayDate] = await Promise.all([getBookingOptions(), today()]);
  // ?customer=…&property=…&date=… prefill from links on other pages
  const customerId = /^\d+$/.test(one(params.customer)) ? one(params.customer) : "";
  const theirs = options.properties.filter((p) => String(p.customerId) === customerId);
  const property =
    theirs.find((p) => String(p.id) === one(params.property)) ?? theirs.find((p) => p.isBilling) ?? theirs[0];
  const date = /^\d{4}-\d{2}-\d{2}$/.test(one(params.date)) ? one(params.date) : todayDate;
  const activeVehicles = options.vehicles.filter((v) => v.isActive);
  const cancelHref = customerId ? `/customers/${customerId}` : "/appointments";

  return (
    <>
      <Link
        href={cancelHref}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {customerId ? "Back to customer" : "Appointments"}
      </Link>
      <h1 className="text-3xl font-bold">New appointment</h1>
      <p className="mt-1 text-sm text-muted-foreground">Fields marked * are required. Times are Eastern.</p>
      <AppointmentForm
        mode="create"
        action={createAppointment}
        options={options}
        cancelHref={cancelHref}
        initialValues={{
          customerId,
          propertyId: property ? String(property.id) : "",
          // the only vehicle is the obvious choice
          vehicleId: activeVehicles.length === 1 ? String(activeVehicles[0].id) : "",
          date,
          start: "09:00",
          end: "11:00",
          price: property?.planRateCents != null ? (property.planRateCents / 100).toFixed(2) : "",
          status: "pending",
          notes: "",
        }}
      />
    </>
  );
}

export default function NewAppointmentPage(props: PageProps<"/appointments/new">) {
  return (
    <div className="max-w-2xl">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <NewAppointmentForm searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
