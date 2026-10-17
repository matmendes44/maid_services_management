import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
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
import { displayName } from "../customers/options";
import { SearchBox, SearchBoxFallback } from "../customers/search-box";
import { getProperties } from "./data";
import { zoneLabels } from "./options";

const frequencyLabels: Record<string, string> = {
  one_time: "One time",
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  every_4_weeks: "Every 4 weeks",
  monthly: "Monthly",
  every_2_months: "Every 2 months",
};

async function PropertyList({ searchParams }: Pick<PageProps<"/properties">, "searchParams">) {
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
  const rows = await getProperties(q);
  const noun = rows.length === 1 ? "property" : "properties";

  return (
    <>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {q ? `${rows.length} ${noun} matching “${q}”` : `${rows.length} ${noun}`}
      </p>
      <div className="mt-4 overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Address</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Zone</TableHead>
              <TableHead>Service plan</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  {q ? "No properties match your search." : "No properties yet."}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((p) => (
                // The address link stretches over the row; the customer link
                // sits above it so both stay clickable.
                <TableRow key={p.id} className="relative">
                  <TableCell>
                    <Link
                      href={`/properties/${p.id}/edit`}
                      className="font-semibold text-foreground after:absolute after:inset-0 hover:text-link focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
                    >
                      {p.street}
                      {p.unit && `, ${p.unit}`}
                    </Link>
                    <div className="text-[0.8rem] text-muted-foreground">
                      {p.city}, {p.state} {p.zip}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/customers/${p.customerId}`}
                      className="relative z-10 text-link underline-offset-4 hover:underline"
                    >
                      {displayName(p)}
                    </Link>
                    <span className="ml-1.5 font-mono text-[0.8rem] text-muted-foreground">
                      {p.customerCode}
                    </span>
                    {p.isBilling && (
                      <Badge variant="info" className="ml-2">Billing</Badge>
                    )}
                  </TableCell>
                  <TableCell>{p.zone ? zoneLabels[p.zone] : "—"}</TableCell>
                  <TableCell>{p.frequency ? frequencyLabels[p.frequency] : "—"}</TableCell>
                  <TableCell>
                    <Badge variant={p.isActive ? "success" : "muted"}>
                      {p.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

export default function PropertiesPage(props: PageProps<"/properties">) {
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Properties</h1>
        <Link href="/properties/new" className={buttonVariants()}>
          <Plus aria-hidden="true" />
          Add property
        </Link>
      </div>
      <div className="mb-4">
        <Suspense fallback={<SearchBoxFallback label="Search properties" />}>
          <SearchBox label="Search properties" placeholder="Search address, ZIP, customer name or code…" />
        </Suspense>
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <PropertyList searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
