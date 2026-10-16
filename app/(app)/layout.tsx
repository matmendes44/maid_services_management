import Link from "next/link";
import { Suspense } from "react";
import { UserMenu } from "./user-menu";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/customers", label: "Customers" },
  { href: "/appointments", label: "Appointments" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b">
        <nav className="mx-auto flex max-w-6xl items-center gap-6 px-8 py-4">
          <span className="text-lg font-bold">MaidCare</span>
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-gray-600 hover:text-black"
            >
              {link.label}
            </Link>
          ))}
          <Suspense>
            <UserMenu />
          </Suspense>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl p-8">{children}</main>
    </div>
  );
}