import { logout } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";

export async function UserMenu() {
  const user = await requireUser();
  return (
    <div className="ml-auto flex items-center gap-3">
      <span className="text-sm text-gray-600">{user.name}</span>
      <form action={logout}>
        <Button type="submit" variant="outline" size="sm">
          Sign out
        </Button>
      </form>
    </div>
  );
}
