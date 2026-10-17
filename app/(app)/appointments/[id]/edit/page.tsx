import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { updateAppointment } from "../../actions";
import { AppointmentForm } from "../../appointment-form";
import { getAppointment, getBookingOptions, parseAppointmentId } from "../../data";
import { formatDay, formatTimeRange, toLocalInputs } from "../../options";

async function EditAppointmentForm({ params }: Pick<PageProps<"/appointments/[id]/edit">, "params">) {
  const id = parseAppointmentId((await params).id);
  const [row, options] = id === null ? [null, null] : await Promise.all([getAppointment(id), getBookingOptions()]);
  if (!row || !options) notFound();
  const a = row.appointment;
  const start = toLocalInputs(a.scheduledStart);
  const end = toLocalInputs(a.scheduledEnd);

  return (
    <>
      <Link
        href={`/appointments/${a.id}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to appointment
      </Link>
      <h1 className="text-3xl font-bold">Edit appointment</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {formatDay(a.scheduledStart)} · {formatTimeRange(a.scheduledStart, a.scheduledEnd)}. Times are Eastern.
      </p>
      <AppointmentForm
        mode="edit"
        action={updateAppointment.bind(null, a.id)}
        options={options}
        cancelHref={`/appointments/${a.id}`}
        initialValues={{
          customerId: String(a.customerId),
          propertyId: String(a.propertyId),
          vehicleId: a.vehicleId ? String(a.vehicleId) : "",
          date: start.date,
          start: start.time,
          end: end.time,
          price: (a.priceCents / 100).toFixed(2),
          status: a.status,
          notes: a.notes ?? "",
        }}
      />
    </>
  );
}

export default function EditAppointmentPage(props: PageProps<"/appointments/[id]/edit">) {
  return (
    <div className="max-w-2xl">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <EditAppointmentForm params={props.params} />
      </Suspense>
    </div>
  );
}
