import { relations } from "drizzle-orm/relations";
import { customers, contacts, properties, servicePlans, payments, appointments, gpsStops } from "../db/schema";

export const customersRelations = relations(customers, ({one, many}) => ({
	customer: one(customers, {
		fields: [customers.referredById],
		references: [customers.id],
		relationName: "customers_referredById_customers_id"
	}),
	customers: many(customers, {
		relationName: "customers_referredById_customers_id"
	}),
	contacts: many(contacts),
	properties: many(properties),
	payments: many(payments),
}));

export const contactsRelations = relations(contacts, ({one}) => ({
	customer: one(customers, {
		fields: [contacts.customerId],
		references: [customers.id]
	}),
}));

export const propertiesRelations = relations(properties, ({one, many}) => ({
	customer: one(customers, {
		fields: [properties.customerId],
		references: [customers.id]
	}),
	servicePlans: many(servicePlans),
	appointments: many(appointments),
	gpsStops: many(gpsStops),
}));

export const servicePlansRelations = relations(servicePlans, ({one, many}) => ({
	property: one(properties, {
		fields: [servicePlans.propertyId],
		references: [properties.id]
	}),
	appointments: many(appointments),
}));

export const paymentsRelations = relations(payments, ({one}) => ({
	customer: one(customers, {
		fields: [payments.customerId],
		references: [customers.id]
	}),
	appointment: one(appointments, {
		fields: [payments.appointmentId],
		references: [appointments.id]
	}),
}));

export const appointmentsRelations = relations(appointments, ({one, many}) => ({
	payments: many(payments),
	property: one(properties, {
		fields: [appointments.propertyId],
		references: [properties.id]
	}),
	servicePlan: one(servicePlans, {
		fields: [appointments.servicePlanId],
		references: [servicePlans.id]
	}),
	gpsStops: many(gpsStops),
}));

export const gpsStopsRelations = relations(gpsStops, ({one}) => ({
	property: one(properties, {
		fields: [gpsStops.propertyId],
		references: [properties.id]
	}),
	appointment: one(appointments, {
		fields: [gpsStops.appointmentId],
		references: [appointments.id]
	}),
}));