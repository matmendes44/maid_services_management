// Shared by server and client code, so only *types* come from the schema.
import type { appointments } from "@/db/schema";

export type AppointmentStatus = (typeof appointments.$inferSelect)["status"];

export const statusLabels: Record<AppointmentStatus, string> = {
  pending: "Pending",
  completed: "Completed",
  canceled: "Canceled",
};
export const appointmentStatuses = Object.keys(statusLabels) as AppointmentStatus[];

export const statusVariant: Record<AppointmentStatus, "info" | "success" | "muted"> = {
  pending: "info",
  completed: "success",
  canceled: "muted",
};

// Remembers the calendar view (day / week / month) last used in this browser. Kept
// here rather than in the client component that sets it: a Server Component
// importing a plain value from a "use client" file gets a reference, not the
// string.
export const VIEW_COOKIE = "appointments_view";

// All scheduling is in the business's own time zone.
export const TIME_ZONE = "America/New_York";

const dayFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: TIME_ZONE,
});
const timeFormat = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});
const partsFormat = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: TIME_ZONE,
});

export const formatDay = (iso: string) => dayFormat.format(new Date(iso));
export const formatTime = (iso: string) => timeFormat.format(new Date(iso));
export function formatTimeRange(start: string, end: string) {
  return `${formatTime(start)} – ${formatTime(end)}`;
}
export function formatDuration(start: string, end: string) {
  const minutes = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h && `${h} h`, m && `${m} min`].filter(Boolean).join(" ") || "0 min";
}

// A stored timestamp as the date ("2026-10-16") and time ("09:00") inputs
// show it in the business's time zone.
export function toLocalInputs(iso: string) {
  const p = Object.fromEntries(partsFormat.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

// "YYYY-MM-DD" arithmetic on calendar dates, independent of time zones.
export function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function startOfMonth(date: string) {
  return `${date.slice(0, 7)}-01`;
}
export function addMonths(date: string, months: number) {
  const d = new Date(`${startOfMonth(date)}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}
export function startOfWeek(date: string) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(date, -((day + 6) % 7)); // weeks start on Monday
}

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
export const formatCents = (cents: number) => money.format(cents / 100);
