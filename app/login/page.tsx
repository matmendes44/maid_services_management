import { Suspense } from "react";
import type { Metadata } from "next";
import { Logo } from "@/components/logo";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in · MaidCare",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col bg-background">
      <div aria-hidden="true" className="h-1 bg-gradient-to-r from-brand-green to-brand-blue" />
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <Logo variant="stacked" className="mx-auto w-48" />
          <div className="mt-6 rounded-xl border bg-card p-6 shadow-sm sm:p-8">
            <h1 className="text-2xl font-bold">Sign in</h1>
            <p className="mt-1 mb-6 text-sm text-muted-foreground">
              Ask an admin if you need an account.
            </p>
            <Suspense>
              <LoginForm />
            </Suspense>
          </div>
        </div>
      </div>
    </main>
  );
}
