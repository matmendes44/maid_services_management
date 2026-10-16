import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCustomerDetail, parseCustomerId } from "../data";
import { displayName, endReasonLabels, formatDay, statusLabels, typeLabels } from "../options";
import { statusVariant } from "../status";

const frequencyLabels: Record<string, string> = {
  one_time: "One time",
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  every_4_weeks: "Every 4 weeks",
  monthly: "Monthly",
  every_2_months: "Every 2 months",
};

const methodLabels: Record<string, string> = {
  stripe: "Stripe",
  zelle_business: "Zelle (business)",
  zelle_personal: "Zelle (personal)",
  venmo: "Venmo",
  check: "Check",
  cash: "Cash",
  other: "Other",
};

const zoneLabels: Record<string, string> = {
  south: "South",
  northwest: "Northwest",
  city_core: "City core",
  north_northeast: "North / Northeast",
  other: "Other",
};

const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const dateFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: "America/New_York",
});
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

const formatDate = (value: string) => dateFormat.format(new Date(value));
const formatCents = (cents: number) => money.format(cents / 100);

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm break-words">{children || "—"}</dd>
    </div>
  );
}

async function CustomerDetail({
  params,
  searchParams,
}: Pick<PageProps<"/customers/[id]">, "params" | "searchParams">) {
  const id = parseCustomerId((await params).id);
  const customer = id === null ? null : await getCustomerDetail(id);
  if (!customer) notFound();

  const { saved } = await searchParams;
  const referredBy = customer.customer;
  const company = customer.companyName;
  const name = displayName(customer);

  return (
    <>
      {(saved === "created" || saved === "updated") && (
        <p
          role="status"
          className="mb-4 rounded-lg border border-green-600/30 bg-green-600/10 px-3 py-2 text-sm"
        >
          {saved === "created" ? "Customer added." : "Changes saved."}
        </p>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="font-mono">{customer.customerCode}</span>
            <span aria-hidden="true">·</span>
            <span>{typeLabels[customer.type]}</span>
            <Badge variant={statusVariant[customer.status]}>{statusLabels[customer.status]}</Badge>
          </div>
        </div>
        <Link href={`/customers/${customer.id}/edit`} className={buttonVariants()}>
          <Pencil aria-hidden="true" />
          Edit
        </Link>
      </div>

      <dl className="mt-6 grid gap-4 rounded-lg border p-4 sm:grid-cols-3">
        <Detail label="Email">
          {customer.email && (
            <a href={`mailto:${customer.email}`} className="underline-offset-4 hover:underline">
              {customer.email}
            </a>
          )}
        </Detail>
        <Detail label="Company">{company !== name ? company : null}</Detail>
        <Detail label="Referred by">
          {referredBy && (
            <Link href={`/customers/${referredBy.id}`} className="underline-offset-4 hover:underline">
              {displayName(referredBy)} ({referredBy.customerCode})
            </Link>
          )}
        </Detail>
        <Detail label="Total paid">
          {formatCents(customer.totals.paidCents)}
          <span className="text-muted-foreground">
            {" "}· {customer.totals.paymentCount}{" "}
            {customer.totals.paymentCount === 1 ? "payment" : "payments"}
          </span>
        </Detail>
        <Detail label="Stripe customer ID">
          {customer.stripeCustomerId && (
            <span className="font-mono text-xs">{customer.stripeCustomerId}</span>
          )}
        </Detail>
        <Detail label="Start date">{formatDay(customer.startDate)}</Detail>
        <Detail label="End date">{customer.endDate && formatDay(customer.endDate)}</Detail>
        {customer.status === "inactive" && (
          <div className="sm:col-span-2">
            <Detail label="Reasons for leaving">
              {customer.endReasons.length > 0 &&
                customer.endReasons.map((r) => endReasonLabels[r]).join(", ")}
            </Detail>
          </div>
        )}
        <div className="sm:col-span-3">
          <Detail label="Notes">
            {customer.notes && <span className="whitespace-pre-wrap">{customer.notes}</span>}
          </Detail>
        </div>
        {customer.customers.length > 0 && (
          <div className="sm:col-span-3">
            <Detail label="Customers they referred">
              <span className="flex flex-wrap gap-x-3 gap-y-1">
                {customer.customers.map((r) => (
                  <Link key={r.id} href={`/customers/${r.id}`} className="underline-offset-4 hover:underline">
                    {displayName(r)}
                  </Link>
                ))}
              </span>
            </Detail>
          </div>
        )}
      </dl>
      <p className="mt-2 text-xs text-muted-foreground">
        Added {formatDate(customer.createdAt)} · last updated {formatDate(customer.updatedAt)}
      </p>

      <Section title="Contacts">
        {customer.contacts.length === 0 ? (
          <Empty>No contacts on file.</Empty>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>SMS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customer.contacts.map((ct) => (
                  <TableRow key={ct.id}>
                    <TableCell>
                      {ct.name ?? "—"}
                      {ct.isPrimary && (
                        <Badge variant="secondary" className="ml-2">Primary</Badge>
                      )}
                    </TableCell>
                    <TableCell>{ct.role ?? "—"}</TableCell>
                    <TableCell>
                      {ct.phone ? (
                        <a href={`tel:${ct.phone}`} className="underline-offset-4 hover:underline">{ct.phone}</a>
                      ) : "—"}
                    </TableCell>
                    <TableCell>{ct.email ?? "—"}</TableCell>
                    <TableCell>{ct.smsOptIn ? "Opted in" : "Opted out"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>

      <Section title="Properties">
        {customer.properties.length === 0 ? (
          <Empty>No properties on file.</Empty>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {customer.properties.map((p) => {
              const plan = p.servicePlans[0];
              return (
                <div key={p.id} className="rounded-lg border p-4 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">
                        {p.street}
                        {p.unit && `, ${p.unit}`}
                      </div>
                      <div className="text-muted-foreground">
                        {p.city}, {p.state} {p.zip}
                      </div>
                    </div>
                    {!p.isActive && <Badge variant="outline">Inactive</Badge>}
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-3">
                    <Detail label="Zone">{p.zone && zoneLabels[p.zone]}</Detail>
                    <Detail label="Service plan">
                      {plan
                        ? `${frequencyLabels[plan.frequency]} · ${formatCents(plan.rateCents)}`
                        : "No open plan"}
                    </Detail>
                    {plan?.preferredWeekday != null && (
                      <Detail label="Preferred day">{weekdays[plan.preferredWeekday]}</Detail>
                    )}
                    {plan && <Detail label="Plan started">{formatDate(plan.startDate)}</Detail>}
                    {p.accessNotes && (
                      <div className="col-span-2">
                        <Detail label="Access notes">
                          <span className="whitespace-pre-wrap">{p.accessNotes}</span>
                        </Detail>
                      </div>
                    )}
                    {p.serviceNotes && (
                      <div className="col-span-2">
                        <Detail label="Service notes">
                          <span className="whitespace-pre-wrap">{p.serviceNotes}</span>
                        </Detail>
                      </div>
                    )}
                  </dl>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <Section title="Recent visits">
        {customer.recentVisits.length === 0 ? (
          <Empty>No visits yet.</Empty>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Crew</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customer.recentVisits.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell>{formatDate(v.scheduledStart)}</TableCell>
                    <TableCell>{v.street}</TableCell>
                    <TableCell>{v.crew ?? "—"}</TableCell>
                    <TableCell className="capitalize">{v.status.replace("_", " ")}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCents(v.priceCents)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>

      <Section title="Recent payments">
        {customer.payments.length === 0 ? (
          <Empty>No payments recorded.</Empty>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Payer</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customer.payments.map((pay) => (
                  <TableRow key={pay.id}>
                    <TableCell>{formatDate(pay.paidAt)}</TableCell>
                    <TableCell>{methodLabels[pay.method]}</TableCell>
                    <TableCell>{pay.payerName ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCents(pay.amountCents)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>
    </>
  );
}

export default function CustomerPage(props: PageProps<"/customers/[id]">) {
  return (
    <div>
      <Link
        href="/customers"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Customers
      </Link>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <CustomerDetail params={props.params} searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
