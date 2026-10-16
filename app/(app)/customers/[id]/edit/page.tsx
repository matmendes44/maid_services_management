import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { updateCustomer } from "../../actions";
import { CustomerForm } from "../../customer-form";
import { getCustomer, getReferrerOptions, parseCustomerId } from "../../data";
import { customerToFormValues, displayName } from "../../options";

async function EditCustomerForm({ params }: Pick<PageProps<"/customers/[id]/edit">, "params">) {
  const id = parseCustomerId((await params).id);
  const [customer, referrers] =
    id === null ? [undefined, []] : await Promise.all([getCustomer(id), getReferrerOptions(id)]);
  if (!customer) notFound();

  return (
    <>
      <Link
        href={`/customers/${customer.id}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {displayName(customer)}
      </Link>
      <h1 className="text-2xl font-bold">Edit customer</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        You&apos;ll be asked to confirm your changes before they&apos;re saved.
      </p>
      <CustomerForm
        mode="edit"
        action={updateCustomer.bind(null, customer.id)}
        initialValues={customerToFormValues(customer)}
        referrers={referrers}
        cancelHref={`/customers/${customer.id}`}
      />
    </>
  );
}

export default function EditCustomerPage(props: PageProps<"/customers/[id]/edit">) {
  return (
    <div className="max-w-2xl">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <EditCustomerForm params={props.params} />
      </Suspense>
    </div>
  );
}
