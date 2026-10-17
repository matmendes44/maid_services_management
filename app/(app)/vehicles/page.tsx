import Link from "next/link";
import { Suspense } from "react";
import { asc, desc, eq, sql } from "drizzle-orm";
import { Plus } from "lucide-react";
import { db } from "@/db";
import { appointments, vehicles } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireUser } from "@/lib/auth/session";

async function getVehicles() {
  await requireUser();
  return db
    .select({
      id: vehicles.id,
      name: vehicles.name,
      plate: vehicles.plate,
      gpsName: vehicles.gpsName,
      isActive: vehicles.isActive,
      upcoming: sql<number>`count(${appointments.id}) filter (where ${appointments.status} = 'pending' and ${appointments.scheduledStart} > now())::int`,
    })
    .from(vehicles)
    .leftJoin(appointments, eq(appointments.vehicleId, vehicles.id))
    .groupBy(vehicles.id)
    .orderBy(desc(vehicles.isActive), asc(vehicles.name));
}

const savedMessages: Record<string, string> = { created: "Vehicle added.", updated: "Vehicle saved." };

async function VehicleList({ searchParams }: Pick<PageProps<"/vehicles">, "searchParams">) {
  const [{ saved }, rows] = await Promise.all([searchParams, getVehicles()]);
  return (
    <>
      {typeof saved === "string" && savedMessages[saved] && (
        <p role="status" className="mb-4 rounded-lg border border-brand-green/40 bg-success px-4 py-2.5 text-sm font-medium text-success-foreground">
          {savedMessages[saved]}
        </p>
      )}
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>License plate</TableHead>
              <TableHead>GPS tracker name</TableHead>
              <TableHead>Upcoming appointments</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  No vehicles yet. Add one to start booking appointments.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((v) => (
                <TableRow key={v.id} className="relative">
                  <TableCell>
                    <Link
                      href={`/vehicles/${v.id}/edit`}
                      className="font-semibold after:absolute after:inset-0 hover:text-link focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
                    >
                      {v.name}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-[0.85rem]">{v.plate ?? "—"}</TableCell>
                  <TableCell>{v.gpsName ?? "—"}</TableCell>
                  <TableCell className="tabular-nums">{v.upcoming}</TableCell>
                  <TableCell>
                    <Badge variant={v.isActive ? "success" : "muted"}>{v.isActive ? "In service" : "Out of service"}</Badge>
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

export default function VehiclesPage(props: PageProps<"/vehicles">) {
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Vehicles</h1>
        <Link href="/vehicles/new" className={buttonVariants()}>
          <Plus aria-hidden="true" />
          Add vehicle
        </Link>
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <VehicleList searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
