import Link from "next/link";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { today as getToday } from "@/lib/today";
import { displayName } from "../customers/options";
import { getAppointmentsBetween } from "./data";
import { GoToDate } from "./go-to-date";
import { RememberView } from "./remember-view";
import {
  addDays,
  addMonths,
  formatCents,
  formatTime,
  formatTimeRange,
  startOfMonth,
  startOfWeek,
  statusLabels,
  VIEW_COOKIE,
  statusVariant,
  toLocalInputs,
} from "./options";

type View = "day" | "week" | "month";
type Row = Awaited<ReturnType<typeof getAppointmentsBetween>>[number];

const dayHeading = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
const fullDay = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
const rangeFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const monthFormat = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const asDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const href = (view: View, date: string) => `/appointments?view=${view}&date=${date}`;

// Appointments grouped by their (Eastern) calendar date.
function groupByDay(rows: Row[], days: string[]) {
  const byDay = new Map(days.map((d) => [d, [] as Row[]]));
  for (const r of rows) byDay.get(toLocalInputs(r.scheduledStart).date)?.push(r);
  return byDay;
}

function Summary({ rows }: { rows: Row[] }) {
  const booked = rows.filter((r) => r.status !== "canceled");
  return (
    <p className="text-sm text-muted-foreground">
      {booked.length} {booked.length === 1 ? "appointment" : "appointments"}
    </p>
  );
}

// One day's heading and appointment rows. In the week view the heading links
// to that day.
function DaySection({ day, today, list, linkHeading }: { day: string; today: string; list: Row[]; linkHeading: boolean }) {
  return (
    <section aria-labelledby={`day-${day}`}>
      <div className="flex items-center justify-between gap-2 rounded-md bg-muted px-3 py-2">
        <h3 id={`day-${day}`} className="flex items-center gap-2 text-[0.95rem] font-semibold">
          {linkHeading ? (
            <Link href={href("day", day)} className="hover:text-link hover:underline underline-offset-4">
              {dayHeading.format(asDate(day))}
            </Link>
          ) : (
            dayHeading.format(asDate(day))
          )}
          {day === today && <Badge variant="success">Today</Badge>}
        </h3>
        <Link
          href={`/appointments/new?date=${day}`}
          className={buttonVariants({ variant: "ghost", size: "sm", className: "text-muted-foreground" })}
          aria-label={`New appointment on ${dayHeading.format(asDate(day))}`}
        >
          <Plus aria-hidden="true" />
          Add
        </Link>
      </div>
      {list.length === 0 ? (
        <p className="px-3 py-3 text-sm text-muted-foreground">No appointments.</p>
      ) : (
        <ul className="divide-y">
          {list.map((r) => (
            <li
              key={r.id}
              // fixed columns so times, vehicles and prices line up across rows
              className="relative grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-1 px-3 py-3 hover:bg-secondary/50 md:grid-cols-[11.5rem_minmax(0,1fr)_9rem_6rem_7rem]"
            >
              <span
                className={cn(
                  "font-semibold whitespace-nowrap tabular-nums",
                  r.status === "canceled" && "text-muted-foreground line-through",
                )}
              >
                {formatTimeRange(r.scheduledStart, r.scheduledEnd)}
              </span>
              <span className="col-span-2 min-w-0 md:col-span-1">
                {/* stretches over the row so the whole row opens it */}
                <Link
                  href={`/appointments/${r.id}`}
                  className="font-semibold after:absolute after:inset-0 hover:text-link focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
                >
                  {displayName(r)}
                </Link>
                <span className="ml-1.5 font-mono text-[0.8rem] text-muted-foreground">{r.customerCode}</span>
                <span className="block text-[0.8rem] text-muted-foreground">
                  {r.street}
                  {r.unit && `, ${r.unit}`}, {r.city}
                </span>
              </span>
              <span className="text-sm text-muted-foreground">{r.vehicleName ?? "No vehicle"}</span>
              <span className="text-sm tabular-nums md:text-right">{formatCents(r.priceCents)}</span>
              <Badge variant={statusVariant[r.status]} className="md:justify-self-end">
                {statusLabels[r.status]}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function WeekView({ monday, today, rows }: { monday: string; today: string; rows: Row[] }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const byDay = groupByDay(rows, days);
  return (
    <div className="grid gap-5">
      {days.map((day) => (
        <DaySection key={day} day={day} today={today} list={byDay.get(day)!} linkHeading />
      ))}
    </div>
  );
}

const MAX_PER_CELL = 3;

// Status as a dot in the month grid, matching the badge colors.
const dotClass = {
  pending: "bg-brand-blue",
  completed: "bg-brand-green",
  canceled: "bg-muted-foreground/40",
} as const;

function MonthView({ month, today, rows }: { month: string; today: string; rows: Row[] }) {
  const gridStart = startOfWeek(month);
  const nextMonth = addMonths(month, 1);
  // whole weeks covering the month: 5 or 6 rows
  const weeks = Math.ceil((asDate(nextMonth).getTime() - asDate(gridStart).getTime()) / (7 * 86400000));
  const days = Array.from({ length: weeks * 7 }, (_, i) => addDays(gridStart, i));
  const byDay = groupByDay(rows, days);

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="grid grid-cols-7 border-b bg-muted/70 text-[0.8rem] font-semibold text-muted-foreground">
        {weekdays.map((d) => (
          <div key={d} className="px-2 py-2 text-center sm:text-left">
            {d}
          </div>
        ))}
      </div>
      <ol className="grid grid-cols-7">
        {days.map((day, i) => {
          const list = byDay.get(day)!;
          const inMonth = day.slice(0, 7) === month.slice(0, 7);
          const active = list.filter((r) => r.status !== "canceled").length;
          return (
            <li
              key={day}
              className={cn(
                "flex min-h-16 min-w-0 flex-col gap-1 border-b p-1 sm:min-h-28 sm:p-1.5",
                i % 7 !== 6 && "border-r",
                i >= days.length - 7 && "border-b-0",
                !inMonth && "bg-muted/40",
              )}
            >
              <div className="flex items-center justify-between gap-1">
                {/* the day number opens that day */}
                <Link
                  href={href("day", day)}
                  className={cn(
                    "grid size-7 place-items-center rounded-full text-sm font-semibold hover:bg-secondary",
                    !inMonth && "font-normal text-muted-foreground",
                    day === today && "bg-brand-blue text-white hover:bg-brand-blue",
                  )}
                  aria-label={`${dayHeading.format(asDate(day))}: ${list.length} ${list.length === 1 ? "appointment" : "appointments"}`}
                >
                  {Number(day.slice(8))}
                </Link>
                {/* phones get a count instead of the entries */}
                {active > 0 && (
                  <span className="rounded-full bg-secondary px-1.5 text-[0.7rem] font-semibold text-secondary-foreground sm:hidden">
                    {active}
                  </span>
                )}
              </div>
              <ul className="hidden min-w-0 gap-0.5 sm:grid">
                {list.slice(0, MAX_PER_CELL).map((r) => (
                  <li key={r.id} className="min-w-0">
                    <Link
                      href={`/appointments/${r.id}`}
                      className={cn(
                        "flex min-w-0 items-center gap-1.5 rounded px-1 py-0.5 text-[0.75rem] hover:bg-secondary",
                        r.status === "canceled" && "text-muted-foreground line-through",
                      )}
                      title={`${formatTimeRange(r.scheduledStart, r.scheduledEnd)} · ${displayName(r)} · ${statusLabels[r.status]}`}
                    >
                      <span className={cn("size-1.5 shrink-0 rounded-full", dotClass[r.status])} aria-hidden="true" />
                      <span className="shrink-0 tabular-nums text-muted-foreground">{formatTime(r.scheduledStart)}</span>
                      <span className="truncate font-medium">{displayName(r)}</span>
                    </Link>
                  </li>
                ))}
                {list.length > MAX_PER_CELL && (
                  <li>
                    <Link href={href("day", day)} className="px-1 text-[0.75rem] font-medium text-link hover:underline">
                      +{list.length - MAX_PER_CELL} more
                    </Link>
                  </li>
                )}
              </ul>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

async function Calendar({ searchParams }: Pick<PageProps<"/appointments">, "searchParams">) {
  const [params, today, cookieStore] = await Promise.all([searchParams, getToday(), cookies()]);
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  // The view in the link wins; otherwise the one last used in this browser.
  const requestedView = one(params.view) ?? cookieStore.get(VIEW_COOKIE)?.value;
  const view: View = requestedView === "month" || requestedView === "day" ? requestedView : "week";
  // `week` is the older link format (?week=YYYY-MM-DD)
  const raw = one(params.date) ?? one(params.week);
  const date = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) && !Number.isNaN(asDate(raw).getTime()) ? raw : today;

  const monday = startOfWeek(date);
  const month = startOfMonth(date);
  const [from, to, prev, next, title, isCurrent] =
    view === "day"
      ? [date, addDays(date, 1), addDays(date, -1), addDays(date, 1), fullDay.format(asDate(date)), date === today]
      : view === "week"
      ? [
          monday,
          addDays(monday, 7),
          addDays(monday, -7),
          addDays(monday, 7),
          `${rangeFormat.format(asDate(monday))} – ${rangeFormat.format(asDate(addDays(monday, 6)))}`,
          monday === startOfWeek(today),
        ]
      : [
          // the whole grid, including the neighbouring months' days shown
          startOfWeek(month),
          startOfWeek(addDays(addMonths(month, 1), 6)),
          addMonths(month, -1),
          addMonths(month, 1),
          monthFormat.format(asDate(month)),
          month === startOfMonth(today),
        ];
  const rows = await getAppointmentsBetween(from, to);
  const deleted = one(params.deleted) === "1";
  // the month's total counts only its own days
  const counted =
    view === "month" ? rows.filter((r) => toLocalInputs(r.scheduledStart).date.startsWith(month.slice(0, 7))) : rows;

  return (
    <>
      <RememberView view={view} />
      {deleted && (
        <p
          role="status"
          className="mb-4 rounded-lg border border-brand-green/40 bg-success px-4 py-2.5 text-sm font-medium text-success-foreground"
        >
          Appointment deleted.
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1">
          <Link href={href(view, prev)} className={buttonVariants({ variant: "outline", size: "icon" })} aria-label={`Previous ${view}`}>
            <ChevronLeft aria-hidden="true" />
          </Link>
          <Link href={href(view, next)} className={buttonVariants({ variant: "outline", size: "icon" })} aria-label={`Next ${view}`}>
            <ChevronRight aria-hidden="true" />
          </Link>
          {!isCurrent && (
            <Link href={href(view, today)} className={buttonVariants({ variant: "ghost" })}>
              Today
            </Link>
          )}
          <h2 className="ml-2 text-lg font-semibold" aria-live="polite">
            {title}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Summary rows={counted} />
          <GoToDate view={view} date={date} />
          <nav aria-label="Calendar view" className="inline-flex rounded-lg border bg-muted p-0.5">
            {(["day", "week", "month"] as const).map((v) => (
              <Link
                key={v}
                href={href(v, date)}
                aria-current={v === view ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-1 text-sm font-medium capitalize text-muted-foreground hover:text-foreground",
                  v === view && "bg-background text-foreground shadow-xs",
                )}
              >
                {v}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      <div className="mt-5">
        {view === "day" ? (
          <DaySection day={date} today={today} list={rows} linkHeading={false} />
        ) : view === "week" ? (
          <WeekView monday={monday} today={today} rows={rows} />
        ) : (
          <MonthView month={month} today={today} rows={rows} />
        )}
      </div>
    </>
  );
}

export default function AppointmentsPage(props: PageProps<"/appointments">) {
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Appointments</h1>
        <Link href="/appointments/new" className={buttonVariants()}>
          <Plus aria-hidden="true" />
          New appointment
        </Link>
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <Calendar searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
