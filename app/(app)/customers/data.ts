import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { requireUser } from "@/lib/auth/session";
import { appointments, customers, payments, properties } from "@/db/schema";
import { displayName } from "./options";

// Options for the "Referred by" select. A customer can't refer themselves,
// so the one being edited is left out.
export async function getReferrerOptions(excludeId?: number) {
  await requireUser();
  const rows = await db
    .select({
      id: customers.id,
      customerCode: customers.customerCode,
      firstName: customers.firstName,
      lastName: customers.lastName,
      companyName: customers.companyName,
    })
    .from(customers)
    .orderBy(asc(customers.firstName), asc(customers.lastName));

  return rows
    .filter((c) => c.id !== excludeId)
    .map((c) => ({ id: c.id, label: `${displayName(c)} (${c.customerCode})` }));
}

export async function getNextCustomerCode() {
  await requireUser();
  const [{ maxCode }] = await db
    .select({
      maxCode: sql<number | null>`max(substring(${customers.customerCode} from '^C(\\d+)$')::int)`,
    })
    .from(customers);
  return `C${(maxCode ?? 1000) + 1}`;
}

// Route params are untrusted strings; anything that isn't a positive integer
// can't be a customer id.
export function parseCustomerId(raw: string) {
  return /^\d+$/.test(raw) ? Number(raw) : null;
}

export async function getCustomer(id: number) {
  await requireUser();
  return db.query.customers.findFirst({ where: eq(customers.id, id) });
}

export async function getCustomerDetail(id: number) {
  await requireUser();
  const [customer, recentVisits, [totals]] = await Promise.all([
    db.query.customers.findFirst({
      where: eq(customers.id, id),
      with: {
        customer: true, // referred by
        customers: { orderBy: asc(customers.firstName) }, // customers they referred
        contacts: true,
        properties: {
          with: { servicePlans: { where: (sp, { isNull }) => isNull(sp.endDate) } },
        },
        payments: { orderBy: desc(payments.paidAt), limit: 10 },
      },
    }),
    db
      .select({
        id: appointments.id,
        scheduledStart: appointments.scheduledStart,
        status: appointments.status,
        priceCents: appointments.priceCents,
        crew: appointments.crew,
        street: properties.street,
      })
      .from(appointments)
      .innerJoin(properties, eq(properties.id, appointments.propertyId))
      .where(eq(properties.customerId, id))
      .orderBy(desc(appointments.scheduledStart))
      .limit(10),
    db
      .select({
        paidCents: sql<number>`coalesce(sum(${payments.amountCents}), 0)::int`,
        paymentCount: sql<number>`count(*)::int`,
      })
      .from(payments)
      .where(eq(payments.customerId, id)),
  ]);

  if (!customer) return null;
  return { ...customer, recentVisits, totals };
}
