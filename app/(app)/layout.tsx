import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { NavLinks, NavLinksFallback } from "./nav-links";
import { UserMenu } from "./user-menu";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div aria-hidden="true" className="h-1 bg-gradient-to-r from-brand-green to-brand-blue" />
      <header className="border-b bg-background">
        <nav className="mx-auto flex h-18 max-w-6xl items-stretch gap-4 px-4 sm:gap-8 sm:px-8">
          <Link href="/" className="flex shrink-0 items-center" aria-label="MaidCare home">
            <Logo compact />
          </Link>
          <div className="flex min-w-0 items-stretch gap-4 overflow-x-auto sm:gap-6">
            <Suspense fallback={<NavLinksFallback />}>
              <NavLinks />
            </Suspense>
          </div>
          <Suspense>
            <UserMenu />
          </Suspense>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-10">{children}</main>
    </div>
  );
}
