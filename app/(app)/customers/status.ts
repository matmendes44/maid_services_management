import type { CustomerStatus } from "./options";

export const statusVariant: Record<
  CustomerStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  lead: "secondary",
  active: "default",
  paused: "outline",
  inactive: "destructive",
};
