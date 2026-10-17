import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { db } from "@/db";
import { vehicles } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { updateVehicle } from "../../actions";
import { VehicleForm } from "../../vehicle-form";

async function EditVehicleForm({ params }: Pick<PageProps<"/vehicles/[id]/edit">, "params">) {
  await requireUser();
  const raw = (await params).id;
  const vehicle = /^\d+$/.test(raw)
    ? await db.query.vehicles.findFirst({ where: eq(vehicles.id, Number(raw)) })
    : undefined;
  if (!vehicle) notFound();
  return (
    <>
      <h1 className="text-3xl font-bold">Edit {vehicle.name}</h1>
      <VehicleForm
        mode="edit"
        action={updateVehicle.bind(null, vehicle.id)}
        initialValues={{
          name: vehicle.name,
          plate: vehicle.plate ?? "",
          gpsName: vehicle.gpsName ?? "",
          isActive: vehicle.isActive,
        }}
      />
    </>
  );
}

export default function EditVehiclePage(props: PageProps<"/vehicles/[id]/edit">) {
  return (
    <div className="max-w-xl">
      <Link href="/vehicles" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Vehicles
      </Link>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <EditVehicleForm params={props.params} />
      </Suspense>
    </div>
  );
}
