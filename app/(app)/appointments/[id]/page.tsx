import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CalendarDays, List, Pencil } from "lucide-react";
import { RecordTabs } from "@/components/record-tabs";
import {
  Empty,
  Field,
  FieldColumn,
  FieldGroup,
  RecordType,
  linkClass,
} from "@/components/record";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { displayName } from "../../customers/options";
import { formatAddress } from "../../properties/options";
import { getAppointment, getAppointmentHistory, parseAppointmentId } from "../data";
import {
  formatCents,
  formatDay,
  formatDuration,
  formatTimeRange,
  statusLabels,
  statusVariant,
  toLocalInputs,
  type AppointmentStatus,
} from "../options";
import { DeleteAppointmentButton } from "./delete-button";
import { StatusButtons } from "./status-buttons";

const frequencyLabels: Record<string, string> = {
  one_time: "One time",
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  every_4_weeks: "Every 4 weeks",
  monthly: "Monthly",
  every_2_months: "Every 2 months",
};

const savedMessages: Record<string, string> = {
  created: "Appointment booked.",
  updated: "Changes saved.",
  completed: "Marked as completed.",
  canceled: "Appointment canceled.",
  pending: "Appointment reopened.",
};

const stampFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/New_York",
});
const formatStamp = (iso: string) => stampFormat.format(new Date(iso));

// How each audited column reads in the history.
const historyLabels: Record<string, string> = {
  status: "Status",
  scheduled_start: "Start",
  scheduled_end: "End",
  vehicle_id: "Vehicle",
  property_id: "Property",
  customer_id: "Customer",
  price_cents: "Price",
  notes: "Notes",
  service_plan_id: "Service plan",
  actual_arrival: "Actual arrival",
  actual_departure: "Actual departure",
  crew: "Crew",
  crew_size: "Crew size",
  gcal_event_id: "Google Calendar event",
  actual_source: "Actual times from",
};

function HistoryValue({
  field,
  value,
  names,
}: {
  field: string;
  value: unknown;
  names: Record<string, Record<number, string>>;
}) {
  if (value === null || value === undefined || value === "") return <span className="text-muted-foreground">(empty)</span>;
  if (field === "status") return <>{statusLabels[value as AppointmentStatus] ?? String(value)}</>;
  if (field === "price_cents" && typeof value === "number") return <>{formatCents(value)}</>;
  if (field.startsWith("scheduled_") || field.startsWith("actual_a") || field.startsWith("actual_d"))
    return <>{formatStamp(String(value))}</>;
  if (field in names && typeof value === "number") return <>{names[field][value] ?? `#${value}`}</>;
  return <>{String(value)}</>;
}

async function AppointmentRecord({
  params,
  searchParams,
}: Pick<PageProps<"/appointments/[id]">, "params" | "searchParams">) {
  const id = parseAppointmentId((await params).id);
  const [row, history] =
    id === null ? [null, null] : await Promise.all([getAppointment(id), getAppointmentHistory(id)]);
  if (!row || !history) notFound();
  const { saved } = await searchParams;
  const a = row.appointment;
  const savedKey = typeof saved === "string" ? saved : "";
  const weekHref = `/appointments?view=week&date=${toLocalInputs(a.scheduledStart).date}`;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <RecordType icon={CalendarDays}>Appointment</RecordType>
          <h1 className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-3xl font-bold">
            <span>
              {formatDay(a.scheduledStart)}
              <span className="text-muted-foreground"> · {formatTimeRange(a.scheduledStart, a.scheduledEnd)}</span>
            </span>
            <Badge variant={statusVariant[a.status]} className="h-7 px-3 text-[0.8rem]">
              {statusLabels[a.status]}
            </Badge>
          </h1>
          <p className="mt-1 text-[0.95rem] text-muted-foreground">
            <Link href={`/customers/${row.customer.id}`} className={linkClass}>
              {row.customer.customerCode} {displayName(row.customer)}
            </Link>{" "}
            · {formatAddress(row.property)}
          </p>
        </div>
        <Link href={weekHref} className={buttonVariants({ variant: "ghost", className: "text-muted-foreground" })}>
          <List aria-hidden="true" />
          Week
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-b pb-4">
        <Link href={`/appointments/${a.id}/edit`} className={buttonVariants()}>
          <Pencil aria-hidden="true" />
          Edit
        </Link>
        <Link href={weekHref} className={buttonVariants({ variant: "outline" })}>
          Back
        </Link>
        <span className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
        <StatusButtons key={a.status} id={a.id} status={a.status} />
        <span className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
        <DeleteAppointmentButton
          id={a.id}
          summary={`${displayName(row.customer)}'s appointment on ${formatDay(a.scheduledStart)}, ${formatTimeRange(a.scheduledStart, a.scheduledEnd)}`}
        />
      </div>

      {savedMessages[savedKey] && (
        <p
          role="status"
          className="mt-4 rounded-lg border border-brand-green/40 bg-success px-4 py-2.5 text-sm font-medium text-success-foreground"
        >
          {savedMessages[savedKey]}
        </p>
      )}

      <div className="mt-6">
        <FieldGroup title="Primary Information">
          <FieldColumn>
            <Field label="Customer">
              <Link href={`/customers/${row.customer.id}`} className={linkClass}>
                {row.customer.customerCode} {displayName(row.customer)}
              </Link>
            </Field>
            <Field label="Status">{statusLabels[a.status]}</Field>
          </FieldColumn>
          <FieldColumn>
            <Field label="Property">
              <Link href={`/properties/${row.property.id}/edit`} className={linkClass}>
                {row.property.street}
                {row.property.unit && `, ${row.property.unit}`}
              </Link>
              <br />
              {row.property.city}, {row.property.state} {row.property.zip}
            </Field>
          </FieldColumn>
          <FieldColumn>
            <Field label="Service plan">
              {row.plan?.frequency &&
                `${frequencyLabels[row.plan.frequency]} · ${formatCents(row.plan.rateCents!)}`}
            </Field>
            <Field label="Access notes">
              {row.property.accessNotes && <span className="whitespace-pre-wrap">{row.property.accessNotes}</span>}
            </Field>
          </FieldColumn>
          <FieldColumn>
            <Field label="Notes">{a.notes && <span className="whitespace-pre-wrap">{a.notes}</span>}</Field>
          </FieldColumn>
        </FieldGroup>

        <FieldGroup title="Schedule | Vehicle">
          <FieldColumn>
            <Field label="Date">{formatDay(a.scheduledStart)}</Field>
          </FieldColumn>
          <FieldColumn>
            <Field label="Time">{formatTimeRange(a.scheduledStart, a.scheduledEnd)}</Field>
            <Field label="Duration">{formatDuration(a.scheduledStart, a.scheduledEnd)}</Field>
          </FieldColumn>
          <FieldColumn>
            <Field label="Vehicle">
              {row.vehicle?.name && (
                <>
                  {row.vehicle.name}
                  {row.vehicle.plate && <span className="text-muted-foreground"> · {row.vehicle.plate}</span>}
                </>
              )}
            </Field>
          </FieldColumn>
          <FieldColumn>
            {a.actualArrival && a.actualDeparture && (
              <Field label="Actual time on site">
                {formatTimeRange(a.actualArrival, a.actualDeparture)}
                <span className="text-muted-foreground"> · {formatDuration(a.actualArrival, a.actualDeparture)}</span>
              </Field>
            )}
          </FieldColumn>
        </FieldGroup>

        <FieldGroup title="Billing">
          <FieldColumn>
            <Field label="Price">
              <span className="font-semibold tabular-nums">{formatCents(a.priceCents)}</span>
            </Field>
          </FieldColumn>
          <FieldColumn>
            <Field label="Paid">{row.paidCents > 0 && formatCents(row.paidCents)}</Field>
          </FieldColumn>
          <FieldColumn>
            <Field label="Invoice">
              <span className="text-muted-foreground">Invoicing isn&apos;t set up yet</span>
            </Field>
          </FieldColumn>
        </FieldGroup>
      </div>

      <RecordTabs
        key={`${a.id}:${history.entries.length}`}
        defaultTab="history"
        tabs={[
          {
            value: "history",
            label: "History",
            count: history.entries.length,
            content:
              history.entries.length === 0 ? (
                <Empty>No changes recorded. Appointments imported before tracking began have no history.</Empty>
              ) : (
                <ol className="grid gap-4">
                  {history.entries.map((e) => {
                    const changes = e.changes as Record<string, { from: unknown; to: unknown }>;
                    return (
                      <li key={e.id} className="grid gap-1 border-l-2 border-brand-blue/30 pl-4">
                        <p className="text-sm">
                          <span className="font-semibold">
                            {e.action === "insert" ? "Created" : e.action === "delete" ? "Deleted" : "Changed"}
                          </span>{" "}
                          by {e.userName ?? <span className="italic">system (outside the app)</span>}
                          <span className="text-muted-foreground"> · {formatStamp(e.changedAt)}</span>
                        </p>
                        {e.action === "update" && (
                          <ul className="grid gap-0.5 text-sm">
                            {Object.entries(changes).map(([field, { from, to }]) => (
                              <li key={field}>
                                <span className="text-muted-foreground">{historyLabels[field] ?? field}:</span>{" "}
                                <span className="line-through decoration-muted-foreground/60">
                                  <HistoryValue field={field} value={from} names={history.names} />
                                </span>{" "}
                                → <HistoryValue field={field} value={to} names={history.names} />
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ol>
              ),
          },
          {
            value: "system",
            label: "System Information",
            content: (
              <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Created">
                  {a.createdAt ? formatStamp(a.createdAt) : <span className="text-muted-foreground">Before tracking began</span>}
                </Field>
                <Field label="Created by">{row.createdByName}</Field>
                <Field label="Last modified">{a.updatedAt && formatStamp(a.updatedAt)}</Field>
                <Field label="Last modified by">
                  {a.updatedAt && (row.updatedByName ?? <span className="italic">system (outside the app)</span>)}
                </Field>
                <Field label="Internal ID">
                  <span className="font-mono">{a.id}</span>
                </Field>
                <Field label="Google Calendar event">
                  {a.gcalEventId && <span className="font-mono text-[0.8rem]">{a.gcalEventId}</span>}
                </Field>
              </dl>
            ),
          },
        ]}
      />
    </>
  );
}

export default function AppointmentPage(props: PageProps<"/appointments/[id]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <AppointmentRecord params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}
