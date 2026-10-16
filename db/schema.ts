import { pgTable, foreignKey, unique, check, bigserial, text, bigint, timestamp, index, uniqueIndex, boolean, char, numeric, integer, smallint, date, pgView, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const customerStatus = pgEnum("customer_status", ['lead', 'active', 'paused', 'inactive'])
export const endReason = pgEnum("end_reason", ['quality', 'scheduling_communication', 'client_circumstances'])
export const customerType = pgEnum("customer_type", ['residential', 'commercial', 'referral_partner'])
export const frequency = pgEnum("frequency", ['one_time', 'weekly', 'biweekly', 'every_4_weeks', 'monthly', 'every_2_months'])
export const payMethod = pgEnum("pay_method", ['stripe', 'zelle_business', 'zelle_personal', 'venmo', 'check', 'cash', 'other'])
export const serviceZone = pgEnum("service_zone", ['south', 'northwest', 'city_core', 'north_northeast', 'other'])


export const customers = pgTable("customers", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	customerCode: text("customer_code").notNull(),
	type: customerType().default('residential').notNull(),
	status: customerStatus().default('lead').notNull(),
	firstName: text("first_name"),
	lastName: text("last_name"),
	companyName: text("company_name"),
	email: text(),
	stripeCustomerId: text("stripe_customer_id"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	referredById: bigint("referred_by_id", { mode: "number" }),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	startDate: date("start_date").default(sql`CURRENT_DATE`).notNull(),
	endDate: date("end_date"),
	endReasons: endReason("end_reasons").array().default(sql`'{}'`).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.referredById],
			foreignColumns: [table.id],
			name: "customers_referred_by_id_fkey"
		}),
	unique("customers_customer_code_key").on(table.customerCode),
	unique("customers_stripe_customer_id_key").on(table.stripeCustomerId),
	check("customers_check", sql`(first_name IS NOT NULL) OR (company_name IS NOT NULL)`),
	check("customers_end_date_status_check", sql`(status = 'inactive'::customer_status) = (end_date IS NOT NULL)`),
	check("customers_end_after_start_check", sql`(end_date IS NULL) OR (end_date >= start_date)`),
	check("customers_end_reasons_status_check", sql`(status = 'inactive'::customer_status) OR (cardinality(end_reasons) = 0)`),
]);

export const contacts = pgTable("contacts", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	customerId: bigint("customer_id", { mode: "number" }).notNull(),
	name: text(),
	role: text(),
	phone: text(),
	email: text(),
	isPrimary: boolean("is_primary").default(false).notNull(),
	smsOptIn: boolean("sms_opt_in").default(true).notNull(),
}, (table) => [
	index("contacts_phone").using("btree", table.phone.asc().nullsLast().op("text_ops")),
	uniqueIndex("one_primary_contact").using("btree", table.customerId.asc().nullsLast().op("int8_ops")).where(sql`is_primary`),
	foreignKey({
			columns: [table.customerId],
			foreignColumns: [customers.id],
			name: "contacts_customer_id_fkey"
		}).onDelete("cascade"),
]);

export const properties = pgTable("properties", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	customerId: bigint("customer_id", { mode: "number" }).notNull(),
	street: text().notNull(),
	unit: text(),
	city: text().notNull(),
	state: char({ length: 2 }).default('MD').notNull(),
	zip: char({ length: 5 }).notNull(),
	lat: numeric({ precision: 9, scale:  6 }),
	lng: numeric({ precision: 9, scale:  6 }),
	zone: serviceZone(),
	accessNotes: text("access_notes"),
	serviceNotes: text("service_notes"),
	isActive: boolean("is_active").default(true).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.customerId],
			foreignColumns: [customers.id],
			name: "properties_customer_id_fkey"
		}).onDelete("cascade"),
	check("properties_zip_check", sql`zip ~ '^\\d{5}$'::text`),
]);

export const servicePlans = pgTable("service_plans", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	propertyId: bigint("property_id", { mode: "number" }).notNull(),
	frequency: frequency().notNull(),
	rateCents: integer("rate_cents").notNull(),
	preferredWeekday: smallint("preferred_weekday"),
	weeksOfMonth: smallint("weeks_of_month").array(),
	defaultPaymentMethod: payMethod("default_payment_method"),
	stripeSubscriptionId: text("stripe_subscription_id"),
	startDate: date("start_date").default(sql`CURRENT_DATE`).notNull(),
	endDate: date("end_date"),
}, (table) => [
	uniqueIndex("one_open_plan_per_property").using("btree", table.propertyId.asc().nullsLast().op("int8_ops")).where(sql`(end_date IS NULL)`),
	foreignKey({
			columns: [table.propertyId],
			foreignColumns: [properties.id],
			name: "service_plans_property_id_fkey"
		}).onDelete("cascade"),
	unique("service_plans_stripe_subscription_id_key").on(table.stripeSubscriptionId),
	check("service_plans_rate_cents_check", sql`rate_cents >= 0`),
	check("service_plans_preferred_weekday_check", sql`(preferred_weekday >= 0) AND (preferred_weekday <= 6)`),
	check("service_plans_check", sql`(end_date IS NULL) OR (end_date >= start_date)`),
]);

export const visitHistory = pgTable("visit_history", {
	customerCode: text("customer_code"),
	visitDate: timestamp("visit_date", { mode: 'string' }),
	arrival: text(),
	departure: text(),
	calendarLabel: text("calendar_label"),
});

export const payments = pgTable("payments", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	customerId: bigint("customer_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	appointmentId: bigint("appointment_id", { mode: "number" }),
	amountCents: integer("amount_cents").notNull(),
	method: payMethod().notNull(),
	payerName: text("payer_name"),
	stripeInvoiceId: text("stripe_invoice_id"),
	paidAt: timestamp("paid_at", { withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
	index("payments_customer_paid").using("btree", table.customerId.asc().nullsLast().op("int8_ops"), table.paidAt.desc().nullsFirst().op("int8_ops")),
	foreignKey({
			columns: [table.customerId],
			foreignColumns: [customers.id],
			name: "payments_customer_id_fkey"
		}),
	foreignKey({
			columns: [table.appointmentId],
			foreignColumns: [appointments.id],
			name: "payments_appointment_id_fkey"
		}),
	unique("payments_stripe_invoice_id_key").on(table.stripeInvoiceId),
]);

export const appointments = pgTable("appointments", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	propertyId: bigint("property_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	servicePlanId: bigint("service_plan_id", { mode: "number" }),
	scheduledStart: timestamp("scheduled_start", { withTimezone: true, mode: 'string' }).notNull(),
	scheduledEnd: timestamp("scheduled_end", { withTimezone: true, mode: 'string' }),
	actualArrival: timestamp("actual_arrival", { withTimezone: true, mode: 'string' }),
	actualDeparture: timestamp("actual_departure", { withTimezone: true, mode: 'string' }),
	crew: text(),
	priceCents: integer("price_cents").notNull(),
	status: text().default('scheduled').notNull(),
	gcalEventId: text("gcal_event_id"),
	crewSize: smallint("crew_size"),
	actualSource: text("actual_source"),
}, (table) => [
	index("appointments_property_start").using("btree", table.propertyId.asc().nullsLast().op("int8_ops"), table.scheduledStart.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.propertyId],
			foreignColumns: [properties.id],
			name: "appointments_property_id_fkey"
		}),
	foreignKey({
			columns: [table.servicePlanId],
			foreignColumns: [servicePlans.id],
			name: "appointments_service_plan_id_fkey"
		}),
	unique("appointments_gcal_event_id_key").on(table.gcalEventId),
	check("appointments_status_check", sql`status = ANY (ARRAY['scheduled'::text, 'completed'::text, 'cancelled'::text, 'no_show'::text])`),
	check("appointments_crew_size_check", sql`(crew_size >= 1) AND (crew_size <= 6)`),
	check("appointments_actual_source_check", sql`actual_source = ANY (ARRAY['gps'::text, 'manual'::text, 'gcal_backfill'::text])`),
	check("actual_times_in_order", sql`(actual_arrival IS NULL) OR (actual_departure IS NULL) OR (actual_departure > actual_arrival)`),
]);

export const gpsTrips = pgTable("gps_trips", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	vehicle: text().notNull(),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }).notNull(),
	endedAt: timestamp("ended_at", { withTimezone: true, mode: 'string' }).notNull(),
	startAddress: text("start_address"),
	endAddress: text("end_address"),
	endLat: numeric("end_lat", { precision: 9, scale:  6 }),
	endLng: numeric("end_lng", { precision: 9, scale:  6 }),
	miles: numeric({ precision: 7, scale:  2 }),
	fuelGal: numeric("fuel_gal", { precision: 6, scale:  3 }),
	sourceFile: text("source_file"),
	importedAt: timestamp("imported_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("gps_trips_vehicle_started_at_key").on(table.startedAt, table.vehicle),
]);

export const gpsStops = pgTable("gps_stops", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	vehicle: text().notNull(),
	arrivedAt: timestamp("arrived_at", { withTimezone: true, mode: 'string' }).notNull(),
	departedAt: timestamp("departed_at", { withTimezone: true, mode: 'string' }).notNull(),
	address: text(),
	lat: numeric({ precision: 9, scale:  6 }),
	lng: numeric({ precision: 9, scale:  6 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	propertyId: bigint("property_id", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	appointmentId: bigint("appointment_id", { mode: "number" }),
	distanceM: integer("distance_m"),
	confidence: text().notNull(),
	resolved: boolean().default(false).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.propertyId],
			foreignColumns: [properties.id],
			name: "gps_stops_property_id_fkey"
		}),
	foreignKey({
			columns: [table.appointmentId],
			foreignColumns: [appointments.id],
			name: "gps_stops_appointment_id_fkey"
		}),
	unique("gps_stops_vehicle_arrived_at_key").on(table.arrivedAt, table.vehicle),
	check("gps_stops_confidence_check", sql`confidence = ANY (ARRAY['high'::text, 'medium'::text, 'review'::text, 'no_match'::text])`),
]);
export const dataIssues = pgView("data_issues", {	issue: text(),
	customerCode: text("customer_code"),
	client: text(),
	detail: text(),
}).as(sql`SELECT 'no property'::text AS issue, c.customer_code, concat_ws(' '::text, c.first_name, c.last_name, c.company_name) AS client, NULL::text AS detail FROM customers c WHERE c.status = 'active'::customer_status AND NOT (EXISTS ( SELECT 1 FROM properties p WHERE p.customer_id = c.id)) UNION ALL SELECT 'no service plan'::text AS issue, c.customer_code, concat_ws(' '::text, c.first_name, c.last_name, c.company_name) AS client, p.street AS detail FROM properties p JOIN customers c ON c.id = p.customer_id WHERE p.is_active AND NOT (EXISTS ( SELECT 1 FROM service_plans sp WHERE sp.property_id = p.id AND sp.end_date IS NULL)) UNION ALL SELECT 'no primary phone'::text AS issue, c.customer_code, concat_ws(' '::text, c.first_name, c.last_name, c.company_name) AS client, NULL::text AS detail FROM customers c WHERE c.status = 'active'::customer_status AND NOT (EXISTS ( SELECT 1 FROM contacts ct WHERE ct.customer_id = c.id AND ct.is_primary AND ct.phone IS NOT NULL)) UNION ALL SELECT 'shared phone'::text AS issue, c.customer_code, concat_ws(' '::text, c.first_name, c.last_name, c.company_name) AS client, ct.phone AS detail FROM contacts ct JOIN customers c ON c.id = ct.customer_id WHERE (ct.phone IN ( SELECT contacts.phone FROM contacts WHERE contacts.phone IS NOT NULL GROUP BY contacts.phone HAVING count(DISTINCT contacts.customer_id) > 1)) UNION ALL SELECT 'shared address'::text AS issue, c.customer_code, concat_ws(' '::text, c.first_name, c.last_name, c.company_name) AS client, p.street AS detail FROM properties p JOIN customers c ON c.id = p.customer_id WHERE (lower(p.street) IN ( SELECT lower(properties.street) AS lower FROM properties GROUP BY (lower(properties.street)) HAVING count(DISTINCT properties.customer_id) > 1)) UNION ALL SELECT 'visit priced $0'::text AS issue, c.customer_code, concat_ws(' '::text, c.first_name, c.last_name, c.company_name) AS client, to_char((a.scheduled_start AT TIME ZONE 'America/New_York'::text), 'MM/DD/YYYY'::text) AS detail FROM appointments a JOIN properties p ON p.id = a.property_id JOIN customers c ON c.id = p.customer_id WHERE a.status = 'completed'::text AND a.price_cents = 0 UNION ALL SELECT 'odd duration'::text AS issue, visit_durations.customer_code, visit_durations.client, ((visit_durations.visit_date || ': '::text) || visit_durations.onsite_min) || ' min'::text AS detail FROM visit_durations WHERE visit_durations.onsite_min < 30 OR visit_durations.onsite_min > 360 UNION ALL SELECT 'double-booked day'::text AS issue, c.customer_code, concat_ws(' '::text, c.first_name, c.last_name, c.company_name) AS client, to_char((a.scheduled_start AT TIME ZONE 'America/New_York'::text), 'MM/DD/YYYY'::text) AS detail FROM appointments a JOIN properties p ON p.id = a.property_id JOIN customers c ON c.id = p.customer_id WHERE a.status <> 'cancelled'::text GROUP BY c.customer_code, (concat_ws(' '::text, c.first_name, c.last_name, c.company_name)), a.property_id, (to_char((a.scheduled_start AT TIME ZONE 'America/New_York'::text), 'MM/DD/YYYY'::text)) HAVING count(*) > 1 UNION ALL SELECT 'active, no visit in 60 days'::text AS issue, c.customer_code, concat_ws(' '::text, c.first_name, c.last_name, c.company_name) AS client, COALESCE('last: '::text || max((a.actual_arrival AT TIME ZONE 'America/New_York'::text)::date)::text, 'never'::text) AS detail FROM customers c LEFT JOIN properties p ON p.customer_id = c.id LEFT JOIN appointments a ON a.property_id = p.id AND a.status = 'completed'::text WHERE c.status = 'active'::customer_status GROUP BY c.id HAVING COALESCE(max(a.actual_arrival), '-infinity'::timestamp with time zone) < (now() - '60 days'::interval)`);

export const monthlyRevenue = pgView("monthly_revenue", {	month: timestamp({ withTimezone: true, mode: 'string' }),
	revenue: numeric(),
}).as(sql`SELECT date_trunc('month'::text, paid_at) AS month, sum(amount_cents)::numeric / 100.0 AS revenue FROM payments GROUP BY (date_trunc('month'::text, paid_at)) ORDER BY (date_trunc('month'::text, paid_at))`);

export const visitDurations = pgView("visit_durations", {	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	appointmentId: bigint("appointment_id", { mode: "number" }),
	customerCode: text("customer_code"),
	client: text(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	propertyId: bigint("property_id", { mode: "number" }),
	visitDate: date("visit_date"),
	actualArrival: timestamp("actual_arrival", { withTimezone: true, mode: 'string' }),
	actualDeparture: timestamp("actual_departure", { withTimezone: true, mode: 'string' }),
	onsiteMin: integer("onsite_min"),
	laborMin: integer("labor_min"),
	crew: text(),
	crewSize: smallint("crew_size"),
	priceCents: integer("price_cents"),
	actualSource: text("actual_source"),
}).as(sql`SELECT a.id AS appointment_id, c.customer_code, COALESCE(NULLIF(concat_ws(' '::text, c.first_name, c.last_name), ''::text), c.company_name) AS client, a.property_id, (a.actual_arrival AT TIME ZONE 'America/New_York'::text)::date AS visit_date, a.actual_arrival, a.actual_departure, round(EXTRACT(epoch FROM a.actual_departure - a.actual_arrival) / 60::numeric)::integer AS onsite_min, round(EXTRACT(epoch FROM a.actual_departure - a.actual_arrival) / 60::numeric * a.crew_size::numeric)::integer AS labor_min, a.crew, a.crew_size, a.price_cents, a.actual_source FROM appointments a JOIN properties p ON p.id = a.property_id JOIN customers c ON c.id = p.customer_id WHERE a.status = 'completed'::text AND a.actual_arrival IS NOT NULL AND a.actual_departure IS NOT NULL`);

export const clientTimeStats = pgView("client_time_stats", {	customerCode: text("customer_code"),
	client: text(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	propertyId: bigint("property_id", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	visits: bigint({ mode: "number" }),
	medianMin: integer("median_min"),
	avgMin: integer("avg_min"),
	minMin: integer("min_min"),
	maxMin: integer("max_min"),
	lastVisit: date("last_visit"),
	revenuePerOnsiteHr: numeric("revenue_per_onsite_hr"),
}).as(sql`SELECT customer_code, client, property_id, count(*) AS visits, percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (onsite_min::double precision))::integer AS median_min, round(avg(onsite_min))::integer AS avg_min, min(onsite_min) AS min_min, max(onsite_min) AS max_min, max(visit_date) AS last_visit, round(sum(price_cents) FILTER (WHERE price_cents > 0)::numeric / 100.0 / NULLIF(sum(onsite_min) FILTER (WHERE price_cents > 0), 0)::numeric * 60::numeric, 2) AS revenue_per_onsite_hr FROM visit_durations WHERE visit_date >= (CURRENT_DATE - 180) GROUP BY customer_code, client, property_id`);

export const houseProfitability = pgView("house_profitability", {	customerCode: text("customer_code"),
	client: text(),
	address: text(),
	zone: serviceZone(),
	frequency: frequency(),
	rate: numeric(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	visits: bigint({ mode: "number" }),
	medianMin: integer("median_min"),
	revenuePerHr: numeric("revenue_per_hr"),
	monthlyRevenue: numeric("monthly_revenue"),
}).as(sql`SELECT s.customer_code, s.client, concat_ws(', '::text, p.street, p.city) AS address, p.zone, sp.frequency, round(sp.rate_cents::numeric / 100.0, 2) AS rate, s.visits, s.median_min, round(sp.rate_cents::numeric / 100.0 / NULLIF(s.median_min, 0)::numeric * 60::numeric, 2) AS revenue_per_hr, round(sp.rate_cents::numeric / 100.0 * CASE sp.frequency WHEN 'weekly'::frequency THEN 52::numeric / 12.0 WHEN 'biweekly'::frequency THEN 26::numeric / 12.0 WHEN 'every_4_weeks'::frequency THEN 13::numeric / 12.0 WHEN 'monthly'::frequency THEN 1::numeric WHEN 'every_2_months'::frequency THEN 0.5 ELSE 0::numeric END, 2) AS monthly_revenue FROM client_time_stats s JOIN properties p ON p.id = s.property_id JOIN service_plans sp ON sp.property_id = s.property_id AND sp.end_date IS NULL ORDER BY (round(sp.rate_cents::numeric / 100.0 / NULLIF(s.median_min, 0)::numeric * 60::numeric, 2)) DESC`);
// Staff who can sign in. There's no public sign-up: accounts are created with
// `npm run users -- add`. Emails are stored lowercased so lookups are exact.
export const users = pgTable("users", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	email: text().notNull(),
	name: text().notNull(),
	passwordHash: text("password_hash").notNull(),
	isDisabled: boolean("is_disabled").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("users_email_key").on(table.email),
	check("users_email_lower_check", sql`email = lower(email)`),
]);

// The session cookie holds a random token; only its SHA-256 hash is stored
// here, so a leaked database can't be used to sign in.
export const sessions = pgTable("sessions", {
	id: text().primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	userId: bigint("user_id", { mode: "number" }).notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("sessions_user_id").using("btree", table.userId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "sessions_user_id_fkey"
		}).onDelete("cascade"),
]);

// Failed sign-ins, used to rate-limit password guessing by email and by IP.
export const loginAttempts = pgTable("login_attempts", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	email: text().notNull(),
	ip: text(),
	attemptedAt: timestamp("attempted_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("login_attempts_email_at").using("btree", table.email.asc().nullsLast().op("text_ops"), table.attemptedAt.asc().nullsLast().op("timestamptz_ops")),
	index("login_attempts_ip_at").using("btree", table.ip.asc().nullsLast().op("text_ops"), table.attemptedAt.asc().nullsLast().op("timestamptz_ops")),
]);
