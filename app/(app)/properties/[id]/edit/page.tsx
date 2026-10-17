import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { getCustomerOptions } from "../../../customers/data";
import { updateProperty } from "../../actions";
import { getProperty, parsePropertyId } from "../../data";
import { formatAddress } from "../../options";
import { PropertyForm } from "../../property-form";

async function EditPropertyForm({ params }: Pick<PageProps<"/properties/[id]/edit">, "params">) {
  const id = parsePropertyId((await params).id);
  const [property, customers] =
    id === null ? [null, []] : await Promise.all([getProperty(id), getCustomerOptions()]);
  if (!property) notFound();

  return (
    <>
      <Link
        href={`/customers/${property.customerId}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to customer
      </Link>
      <h1 className="text-3xl font-bold">Edit property</h1>
      <p className="mt-1 text-sm text-muted-foreground">{formatAddress(property)}</p>
      <PropertyForm
        mode="edit"
        action={updateProperty.bind(null, property.id)}
        customers={customers}
        initialValues={{
          customerId: String(property.customerId),
          street: property.street,
          unit: property.unit ?? "",
          city: property.city,
          state: property.state,
          zip: property.zip,
          zone: property.zone ?? "",
          accessNotes: property.accessNotes ?? "",
          serviceNotes: property.serviceNotes ?? "",
          isActive: property.isActive,
          isBilling: property.isBilling,
        }}
        cancelHref={`/customers/${property.customerId}`}
      />
    </>
  );
}

export default function EditPropertyPage(props: PageProps<"/properties/[id]/edit">) {
  return (
    <div className="max-w-2xl">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <EditPropertyForm params={props.params} />
      </Suspense>
    </div>
  );
}
