import Link from "next/link";
import { Suspense } from "react";
import { ilike, or, sql, type SQL } from "drizzle-orm";
import { ArrowDown, ArrowUp, ArrowUpDown, Plus } from "lucide-react";
import { db } from "@/db";
import { requireUser } from "@/lib/auth/session";
import { contacts, customers, properties } from "@/db/schema";
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
import { displayName, statusLabels, typeLabels } from "./options";
import { SearchBox, SearchBoxFallback } from "./search-box";
import { statusVariant } from "./status";

type SortDir = "asc" | "desc";

// Each sort key maps to the SQL expressions it orders by. Sorting happens in
// the database so it stays correct however the list grows.
const sortOptions = {
  code: {
    label: "Code",
    defaultDir: "asc",
    // length first so C10000 sorts after C9999
    by: [sql`length(${customers.customerCode})`, sql`${customers.customerCode}`],
  },
  name: {
    label: "Name",
    defaultDir: "asc",
    by: [
      sql`lower(coalesce(nullif(concat_ws(' ', ${customers.firstName}, ${customers.lastName}), ''), ${customers.companyName}))`,
    ],
  },
  type: { label: "Type", defaultDir: "asc", by: [sql`${customers.type}`] },
  // enum order: lead → active → paused → lapsed → churned
  status: { label: "Status", defaultDir: "asc", by: [sql`${customers.status}`] },
  email: { label: "Email", defaultDir: "asc", by: [sql`lower(${customers.email})`] },
  created: { label: "Added", defaultDir: "desc", by: [sql`${customers.createdAt}`] },
} satisfies Record<string, { label: string; defaultDir: SortDir; by: SQL[] }>;

type SortKey = keyof typeof sortOptions;

const dateFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: "America/New_York",
});

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseParams(params: Record<string, string | string[] | undefined>) {
  const raw = first(params.sort);
  const sort: SortKey = raw && raw in sortOptions ? (raw as SortKey) : "name";
  const rawDir = first(params.dir);
  const dir: SortDir =
    rawDir === "asc" || rawDir === "desc" ? rawDir : sortOptions[sort].defaultDir;
  const q = first(params.q)?.trim() ?? "";
  return { sort, dir, q };
}

// Matches the customer's own fields plus their contacts (name, email, phone)
// and property addresses. Phone matching ignores formatting, so "4105551234"
// finds "(410) 555-1234".
function searchCondition(q: string) {
  const pattern = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
  const digits = q.replace(/\D/g, "");
  const phoneMatch =
    digits.length >= 3
      ? sql`or regexp_replace(${contacts.phone}, '\\D', '', 'g') like ${`%${digits}%`}`
      : sql``;

  return or(
    ilike(customers.customerCode, pattern),
    ilike(customers.companyName, pattern),
    ilike(customers.email, pattern),
    sql`concat_ws(' ', ${customers.firstName}, ${customers.lastName}) ilike ${pattern}`,
    sql`exists (select 1 from ${contacts} where ${contacts.customerId} = ${customers.id}
      and (${contacts.name} ilike ${pattern} or ${contacts.email} ilike ${pattern} ${phoneMatch}))`,
    sql`exists (select 1 from ${properties} where ${properties.customerId} = ${customers.id}
      and concat_ws(' ', ${properties.street}, ${properties.unit}, ${properties.city}, ${properties.zip}) ilike ${pattern})`,
  );
}

async function getCustomers(sort: SortKey, dir: SortDir, q: string) {
  await requireUser();
  const direction = dir === "asc" ? sql`asc` : sql`desc`;
  const orderBy = sortOptions[sort].by.map(
    (expr) => sql`${expr} ${direction} nulls last`,
  );
  return db
    .select()
    .from(customers)
    .where(q ? searchCondition(q) : undefined)
    .orderBy(...orderBy, customers.id);
}

function SortHeader({
  column,
  sort,
  dir,
  q,
}: {
  column: SortKey;
  sort: SortKey;
  dir: SortDir;
  q: string;
}) {
  const active = column === sort;
  const nextDir: SortDir = active
    ? dir === "asc"
      ? "desc"
      : "asc"
    : sortOptions[column].defaultDir;
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  const params = new URLSearchParams({ sort: column, dir: nextDir });
  if (q) params.set("q", q);

  return (
    <TableHead
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <Link
        href={`/customers?${params}`}
        scroll={false}
        className="inline-flex items-center gap-1 hover:text-foreground"
      >
        {sortOptions[column].label}
        <Icon
          className={active ? "size-3.5" : "size-3.5 text-muted-foreground/50"}
          aria-hidden="true"
        />
      </Link>
    </TableHead>
  );
}

async function CustomerList({
  searchParams,
}: Pick<PageProps<"/customers">, "searchParams">) {
  const { sort, dir, q } = parseParams(await searchParams);
  const rows = await getCustomers(sort, dir, q);
  const noun = rows.length === 1 ? "customer" : "customers";

  return (
    <>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {q ? `${rows.length} ${noun} matching “${q}”` : `${rows.length} ${noun}`} · sorted by{" "}
        {sortOptions[sort].label.toLowerCase()} ({dir === "asc" ? "ascending" : "descending"})
      </p>

      <div className="mt-4 rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {(Object.keys(sortOptions) as SortKey[]).map((column) => (
                <SortHeader key={column} column={column} sort={sort} dir={dir} q={q} />
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  {q ? "No customers match your search." : "No customers yet."}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((c) => {
                const name = displayName(c);
                const showCompany = c.companyName && c.companyName !== name;
                return (
                  // The name link stretches over the whole row, so clicking
                  // anywhere on it opens the customer.
                  <TableRow key={c.id} className="relative cursor-pointer">
                    <TableCell className="font-mono text-xs">{c.customerCode}</TableCell>
                    <TableCell>
                      <Link
                        href={`/customers/${c.id}`}
                        className="font-medium after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
                      >
                        {name}
                      </Link>
                      {showCompany && (
                        <div className="text-xs text-muted-foreground">{c.companyName}</div>
                      )}
                    </TableCell>
                    <TableCell>{typeLabels[c.type]}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[c.status]}>
                        {statusLabels[c.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.email ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {dateFormat.format(new Date(c.createdAt))}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

export default function CustomersPage(props: PageProps<"/customers">) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Customers</h1>
        <Link href="/customers/new" className={buttonVariants()}>
          <Plus aria-hidden="true" />
          Add customer
        </Link>
      </div>
      <div className="mb-3">
        <Suspense fallback={<SearchBoxFallback />}>
          <SearchBox />
        </Suspense>
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <CustomerList searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
