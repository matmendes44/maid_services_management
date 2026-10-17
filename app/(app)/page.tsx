import Link from "next/link";
import { ArrowRight, CalendarDays, House, Users } from "lucide-react";

const sections = [
  {
    href: "/customers",
    title: "Customers",
    description: "Look up, add and update customers, their properties and service plans.",
    icon: Users,
  },
  {
    href: "/properties",
    title: "Properties",
    description: "Every address you clean, who it belongs to, and notes for the crew.",
    icon: House,
  },
  {
    href: "/appointments",
    title: "Appointments",
    description: "Book visits by week, assign vehicles, and see who changed what.",
    icon: CalendarDays,
  },
];

export default function Home() {
  return (
    <div>
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <p className="mt-2 text-muted-foreground">Where would you like to start?</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map(({ href, title, description, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group rounded-xl border bg-card p-6 transition-colors hover:border-brand-blue/40 hover:bg-secondary/40"
          >
            <span className="grid size-10 place-items-center rounded-lg bg-accent text-accent-foreground">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <h2 className="mt-4 flex items-center gap-1.5 text-lg font-semibold">
              {title}
              <ArrowRight
                className="size-4 text-brand-blue transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
