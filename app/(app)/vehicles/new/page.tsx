import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createVehicle } from "../actions";
import { VehicleForm } from "../vehicle-form";

export default function NewVehiclePage() {
  return (
    <div className="max-w-xl">
      <Link href="/vehicles" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Vehicles
      </Link>
      <h1 className="text-3xl font-bold">Add vehicle</h1>
      <VehicleForm mode="create" action={createVehicle} initialValues={{ name: "", plate: "", gpsName: "", isActive: true }} />
    </div>
  );
}
