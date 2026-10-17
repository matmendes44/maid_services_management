import { LogOut } from "lucide-react";
import { logout } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";

export async function UserMenu() {
  const user = await requireUser();
  const initial = user.name.trim().charAt(0).toUpperCase();
  return (
    <div className="ml-auto flex shrink-0 items-center gap-3">
      <span className="hidden items-center gap-2 sm:flex">
        <span
          aria-hidden="true"
          className="grid size-8 place-items-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground"
        >
          {initial}
        </span>
        <span className="text-sm font-medium">{user.name}</span>
      </span>
      <form action={logout}>
        <Button type="submit" variant="outline" size="sm">
          <LogOut aria-hidden="true" />
          <span className="max-sm:sr-only">Sign out</span>
        </Button>
      </form>
    </div>
  );
}
