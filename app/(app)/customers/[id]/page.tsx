import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  ArrowLeft,
  ArrowRight,
  List,
  Mail,
  Pencil,
  Phone,
  Plus,
  UserRound,
} from "lucide-react";
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
import { cn } from "cn";
import { zoneLabels } from "../../properties/options";
import { AddContact } from "../add-contact";
import { getAdjacentCustomers, getCustomerDetail, parseCustomerId } from "../data";
import {
  displayName,
  endReasonLabels,
  formatDay,
  formatPhone,
  statusLabels,
  typeLabels,
} from "../options";
import { statusVariant } from "../status";
import { RecordTabs } from "@/components/record-tabs";
import {
  Empty,
  Field,
  FieldColumn,
  FieldGroup,
  RecordType,
  TableFrame,
  Toolbar,
  linkClass,
} from "@/components/record";

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

const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const dateFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: "America/New_York",
});
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

const formatDate = (value: string) => dateFormat.format(new Date(value));
const formatCents = (cents: number) => money.format(cents / 100);

const savedMessages: Record<string, string> = {
  created: "Customer added.",
  updated: "Changes saved.",
  property: "Property saved.",
  contact: "Contact added.",
};

// Which tab to open after a save, so the change is in view.
const savedTabs: Record<string, string> = { property: "properties", contact: "contacts" };

const link = linkClass;

async function CustomerRecord({
  params,
  searchParams,
}: Pick<PageProps<"/customers/[id]">, "params" | "searchParams">) {
  const id = parseCustomerId((await params).id);
  const customer = id === null ? null : await getCustomerDetail(id);
  if (!customer) notFound();
  const [{ saved }, { prevId, nextId }] = await Promise.all([
    searchParams,
    getAdjacentCustomers(customer.customerCode),
  ]);

  const name = displayName(customer);
  const billing = customer.properties.find((p) => p.id === customer.billingPropertyId);
  const primary = customer.contacts.find((ct) => ct.isPrimary);
  const otherPhones = customer.contacts.filter((ct) => ct !== primary && ct.phone);
  const email = customer.email ?? primary?.email ?? null;
  const savedKey = typeof saved === "string" ? saved : "";
  const defaultTab = savedTabs[savedKey] ?? "contacts";

  const navButton = "size-9 text-muted-foreground hover:text-foreground";

  return (
    <>
      {/* Record header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <RecordType icon={UserRound}>Customer</RecordType>
          <h1 className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-3xl font-bold">
            <span>
              <span className="text-muted-foreground">{customer.customerCode}</span> {name}
            </span>
            <Badge variant={statusVariant[customer.status]} className="h-7 px-3 text-[0.8rem]">
              {statusLabels[customer.status]}
            </Badge>
          </h1>
        </div>
        <nav aria-label="Customer records" className="flex items-center gap-1">
          {prevId ? (
            <Link
              href={`/customers/${prevId}`}
              className={buttonVariants({ variant: "ghost", size: "icon", className: navButton })}
              aria-label="Previous customer"
            >
              <ArrowLeft aria-hidden="true" />
            </Link>
          ) : (
            <span className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "opacity-30")} aria-hidden="true">
              <ArrowLeft />
            </span>
          )}
          {nextId ? (
            <Link
              href={`/customers/${nextId}`}
              className={buttonVariants({ variant: "ghost", size: "icon", className: navButton })}
              aria-label="Next customer"
            >
              <ArrowRight aria-hidden="true" />
            </Link>
          ) : (
            <span className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "opacity-30")} aria-hidden="true">
              <ArrowRight />
            </span>
          )}
          <Link href="/customers" className={buttonVariants({ variant: "ghost", className: "text-muted-foreground" })}>
            <List aria-hidden="true" />
            List
          </Link>
        </nav>
      </div>

      {/* Action bar */}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-b pb-4">
        <Link href={`/customers/${customer.id}/edit`} className={buttonVariants()}>
          <Pencil aria-hidden="true" />
          Edit
        </Link>
        <Link href="/customers" className={buttonVariants({ variant: "outline" })}>
          Back
        </Link>
        <span className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
        <Link
          href={`/properties/new?customer=${customer.id}`}
          className={buttonVariants({ variant: "outline" })}
        >
          <Plus aria-hidden="true" />
          Add property
        </Link>
        {primary?.phone && (
          <a href={`tel:${primary.phone}`} className={buttonVariants({ variant: "outline" })}>
            <Phone aria-hidden="true" />
            Call
          </a>
        )}
        {email && (
          <a href={`mailto:${email}`} className={buttonVariants({ variant: "outline" })}>
            <Mail aria-hidden="true" />
            Email
          </a>
        )}
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
            <Field label="Customer ID">
              <span className="font-mono">{customer.customerCode}</span>
            </Field>
            <Field label="Name">{[customer.firstName, customer.lastName].filter(Boolean).join(" ")}</Field>
            <Field label="Company name">{customer.companyName}</Field>
          </FieldColumn>
          <FieldColumn>
            <Field label="Type">{typeLabels[customer.type]}</Field>
            <Field label="Status">{statusLabels[customer.status]}</Field>
            <Field label="Referred by">
              {customer.customer && (
                <Link href={`/customers/${customer.customer.id}`} className={link}>
                  {customer.customer.customerCode} {displayName(customer.customer)}
                </Link>
              )}
            </Field>
          </FieldColumn>
          <FieldColumn>
            <Field label="Start date">{formatDay(customer.startDate)}</Field>
            <Field label="End date">{customer.endDate && formatDay(customer.endDate)}</Field>
            {customer.status === "inactive" && (
              <Field label="Reasons for leaving">
                {customer.endReasons.map((r) => endReasonLabels[r]).join(", ")}
              </Field>
            )}
            {customer.customers.length > 0 && (
              <Field label="Customers they referred">
                <span className="flex flex-wrap gap-x-3 gap-y-1">
                  {customer.customers.map((r) => (
                    <Link key={r.id} href={`/customers/${r.id}`} className={link}>
                      {displayName(r)}
                    </Link>
                  ))}
                </span>
              </Field>
            )}
          </FieldColumn>
          <FieldColumn>
            <Field label="Total paid">
              <span className="font-semibold tabular-nums">
                {formatCents(customer.totals.paidCents)}
              </span>
              <span className="text-muted-foreground">
                {" "}· {customer.totals.paymentCount}{" "}
                {customer.totals.paymentCount === 1 ? "payment" : "payments"}
              </span>
            </Field>
            <Field label="Stripe customer ID">
              {customer.stripeCustomerId && (
                <span className="font-mono text-[0.85rem]">{customer.stripeCustomerId}</span>
              )}
            </Field>
            <Field label="Notes">
              {customer.notes && <span className="whitespace-pre-wrap">{customer.notes}</span>}
            </Field>
          </FieldColumn>
        </FieldGroup>

        <FieldGroup title="Email | Phone | Address">
          <FieldColumn>
            <Field label="Billing address">
              {billing && (
                <>
                  {billing.street}
                  {billing.unit && `, ${billing.unit}`}
                  <br />
                  {billing.city}, {billing.state} {billing.zip}
                </>
              )}
            </Field>
            <Field label="Text messages">
              {primary && (primary.smsOptIn ? "Opted in" : "Opted out")}
            </Field>
          </FieldColumn>
          <FieldColumn>
            <Field label="Phone">
              {primary?.phone && (
                <a href={`tel:${primary.phone}`} className={link}>
                  {formatPhone(primary.phone)}
                </a>
              )}
            </Field>
            {otherPhones.map((ct) => (
              <Field key={ct.id} label={ct.role || ct.name || "Other phone"}>
                <a href={`tel:${ct.phone}`} className={link}>
                  {formatPhone(ct.phone!)}
                </a>
              </Field>
            ))}
          </FieldColumn>
          <FieldColumn>
            <Field label="Email">
              {email && (
                <a href={`mailto:${email}`} className={link}>
                  {email}
                </a>
              )}
            </Field>
            <Field label="Primary contact">{primary?.name}</Field>
          </FieldColumn>
          <FieldColumn>
            <Field label="Access notes">
              {billing?.accessNotes && <span className="whitespace-pre-wrap">{billing.accessNotes}</span>}
            </Field>
          </FieldColumn>
        </FieldGroup>
      </div>

      {/* Next keeps visited pages alive and re-renders them on return, and a
          tab bar's starting tab can't change once it's mounted; the key mounts
          a fresh one per customer and starting tab instead. */}
      <RecordTabs
        key={`${customer.id}:${defaultTab}`}
        defaultTab={defaultTab}
        tabs={[
          {
            value: "contacts",
            label: "Contacts",
            count: customer.contacts.length,
            content: (
              <>
                <Toolbar>
                  {/* remounts (closing the form) once a contact has been added */}
                  <AddContact
                    key={customer.contacts.length}
                    customerId={customer.id}
                    hasPrimary={Boolean(primary)}
                  />
                </Toolbar>
                {customer.contacts.length === 0 ? (
                  <Empty>No contacts on file.</Empty>
                ) : (
                  <TableFrame>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Texts</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {customer.contacts.map((ct) => (
                          <TableRow key={ct.id}>
                            <TableCell>
                              {ct.name ?? "—"}
                              {ct.isPrimary && (
                                <Badge variant="info" className="ml-2">Primary</Badge>
                              )}
                            </TableCell>
                            <TableCell>{ct.role ?? "—"}</TableCell>
                            <TableCell>
                              {ct.phone ? (
                                <a href={`tel:${ct.phone}`} className={link}>{formatPhone(ct.phone)}</a>
                              ) : "—"}
                            </TableCell>
                            <TableCell>
                              {ct.email ? (
                                <a href={`mailto:${ct.email}`} className={link}>{ct.email}</a>
                              ) : "—"}
                            </TableCell>
                            <TableCell>{ct.smsOptIn ? "Opted in" : "Opted out"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableFrame>
                )}
              </>
            ),
          },
          {
            value: "properties",
            label: "Properties",
            count: customer.properties.length,
            content: (
              <>
                <Toolbar>
                  <Link
                    href={`/properties/new?customer=${customer.id}`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    <Plus aria-hidden="true" />
                    Add property
                  </Link>
                </Toolbar>
                {customer.properties.length === 0 ? (
                  <Empty>No properties on file.</Empty>
                ) : (
                  <TableFrame>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">Edit</TableHead>
                          <TableHead>Address</TableHead>
                          <TableHead>Zone</TableHead>
                          <TableHead>Service plan</TableHead>
                          <TableHead>Preferred day</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {customer.properties.map((p) => {
                          const plan = p.servicePlans[0];
                          return (
                            <TableRow key={p.id} className="align-top">
                              <TableCell>
                                <Link
                                  href={`/properties/${p.id}/edit`}
                                  className={link}
                                  aria-label={`Edit ${p.street}`}
                                >
                                  Edit
                                </Link>
                              </TableCell>
                              <TableCell className="whitespace-normal">
                                <div className="font-medium">
                                  {p.street}
                                  {p.unit && `, ${p.unit}`}
                                </div>
                                <div className="text-[0.8rem] text-muted-foreground">
                                  {p.city}, {p.state} {p.zip}
                                </div>
                                {(p.accessNotes || p.serviceNotes) && (
                                  <div className="mt-1 max-w-md text-[0.8rem] whitespace-pre-wrap text-muted-foreground">
                                    {[p.accessNotes, p.serviceNotes].filter(Boolean).join("\n")}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>{p.zone ? zoneLabels[p.zone] : "—"}</TableCell>
                              <TableCell>
                                {plan
                                  ? `${frequencyLabels[plan.frequency]} · ${formatCents(plan.rateCents)}`
                                  : "—"}
                              </TableCell>
                              <TableCell>
                                {plan?.preferredWeekday != null ? weekdays[plan.preferredWeekday] : "—"}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1.5">
                                  <Badge variant={p.isActive ? "success" : "muted"}>
                                    {p.isActive ? "Active" : "Inactive"}
                                  </Badge>
                                  {p.id === customer.billingPropertyId && (
                                    <Badge variant="info">Billing</Badge>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableFrame>
                )}
              </>
            ),
          },
          {
            value: "visits",
            label: "Visits",
            content:
              customer.recentVisits.length === 0 ? (
                <Empty>No visits yet.</Empty>
              ) : (
                <>
                  <p className="mb-3 text-sm text-muted-foreground">The 10 most recent visits.</p>
                  <TableFrame>
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
                  </TableFrame>
                </>
              ),
          },
          {
            value: "payments",
            label: "Payments",
            count: customer.totals.paymentCount,
            content:
              customer.payments.length === 0 ? (
                <Empty>No payments recorded.</Empty>
              ) : (
                <>
                  <p className="mb-3 text-sm text-muted-foreground">
                    The 10 most recent payments · {formatCents(customer.totals.paidCents)} paid in total.
                  </p>
                  <TableFrame>
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
                  </TableFrame>
                </>
              ),
          },
          {
            value: "system",
            label: "System Information",
            content: (
              <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Date created">{formatDate(customer.createdAt)}</Field>
                <Field label="Last modified">{formatDate(customer.updatedAt)}</Field>
                <Field label="Internal ID">
                  <span className="font-mono">{customer.id}</span>
                </Field>
              </dl>
            ),
          },
        ]}
      />
    </>
  );
}

export default function CustomerPage(props: PageProps<"/customers/[id]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <CustomerRecord params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}
