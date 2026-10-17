"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/customers", label: "Customers" },
  { href: "/properties", label: "Properties" },
  { href: "/appointments", label: "Appointments" },
  { href: "/vehicles", label: "Vehicles" },
];

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex h-full items-center px-1 text-[0.95rem] font-medium transition-colors",
        // green underline marks the current section
        "after:absolute after:inset-x-0 after:-bottom-px after:h-[3px] after:rounded-full",
        active
          ? "text-foreground after:bg-brand-green"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </Link>
  );
}

export function NavLinks() {
  const pathname = usePathname();
  return links.map((link) => (
    <NavLink
      key={link.href}
      {...link}
      active={link.href === "/" ? pathname === "/" : pathname.startsWith(link.href)}
    />
  ));
}

// Rendered while the current path isn't known yet.
export function NavLinksFallback() {
  return links.map((link) => <NavLink key={link.href} {...link} active={false} />);
}
