import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { today } from "@/lib/today";
import { createCustomer } from "../actions";
import { CustomerForm } from "../customer-form";
import { getNextCustomerCode, getReferrerOptions } from "../data";

async function NewCustomerForm() {
  const [suggestedCode, referrers, startDate] = await Promise.all([
    getNextCustomerCode(),
    getReferrerOptions(),
    today(),
  ]);
  return (
    <CustomerForm
      mode="create"
      action={createCustomer}
      referrers={referrers}
      cancelHref="/customers"
      initialValues={{
        customerCode: suggestedCode,
        type: "residential",
        status: "lead",
        startDate,
        endDate: "",
        endReasons: "",
        firstName: "",
        lastName: "",
        companyName: "",
        email: "",
        referredById: "",
        billingPropertyId: "",
        stripeCustomerId: "",
        notes: "",
      }}
    />
  );
}

export default function NewCustomerPage() {
  return (
    <div className="max-w-2xl">
      <Link
        href="/customers"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Customers
      </Link>
      <h1 className="text-3xl font-bold">Add customer</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Fields marked * are required. A customer needs a first name or a company name.
      </p>
      <Suspense fallback={<p className="mt-6 text-sm text-muted-foreground">Loading…</p>}>
        <NewCustomerForm />
      </Suspense>
    </div>
  );
}
