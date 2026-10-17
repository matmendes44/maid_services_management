import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { getCustomerOptions } from "../../customers/data";
import { createProperty } from "../actions";
import { PropertyForm } from "../property-form";

async function NewPropertyForm({ searchParams }: Pick<PageProps<"/properties/new">, "searchParams">) {
  const raw = (await searchParams).customer;
  const customerId = typeof raw === "string" && /^\d+$/.test(raw) ? raw : "";
  const customers = await getCustomerOptions();
  // came from a customer's page: go back there on cancel
  const cancelHref = customerId ? `/customers/${customerId}` : "/properties";

  return (
    <>
      <Link
        href={cancelHref}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {customerId ? "Back to customer" : "Properties"}
      </Link>
      <h1 className="text-3xl font-bold">Add property</h1>
      <p className="mt-1 text-sm text-muted-foreground">Fields marked * are required.</p>
      <PropertyForm
        mode="create"
        action={createProperty}
        customers={customers}
        initialValues={{ customerId }}
        cancelHref={cancelHref}
      />
    </>
  );
}

export default function NewPropertyPage(props: PageProps<"/properties/new">) {
  return (
    <div className="max-w-2xl">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <NewPropertyForm searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
