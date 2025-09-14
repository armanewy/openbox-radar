import { pgTable, serial, text, integer, timestamp, uuid, pgEnum, boolean } from "drizzle-orm/pg-core";

export const planEnum = pgEnum("plan_t", ['free','basic','pro']);
export const retailerEnum = pgEnum("retailer_t", ['bestbuy','microcenter']);
export const condEnum = pgEnum("cond_rank_t", ['certified','excellent','satisfactory','fair','unknown']);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  plan: planEnum("plan").default('free').notNull(),
  status: text("status").default('active').notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const watches = pgTable("watches", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  retailer: retailerEnum("retailer").notNull(),
  sku: text("sku"),
  productUrl: text("product_url"),
  keywords: text("keywords").array(),
  zipcode: text("zipcode"),
  radiusMiles: integer("radius_miles").default(25),
  stores: text("stores").array(),
  priceCeilingCents: integer("price_ceiling_cents"),
  minCondition: condEnum("min_condition").default('fair').notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const stores = pgTable("stores", {
  retailer: retailerEnum("retailer").notNull(),
  storeId: text("store_id").notNull(),
  name: text("name").notNull(),
  lat: integer("lat"),
  lng: integer("lng"),
  zipcode: text("zipcode"),
  city: text("city"),
  state: text("state"),
});

export const inventory = pgTable("inventory", {
  id: serial("id").primaryKey(),
  retailer: retailerEnum("retailer").notNull(),
  storeId: text("store_id").notNull(),
  sku: text("sku"),
  title: text("title").notNull(),
  conditionLabel: text("condition_label").notNull(),
  conditionRank: condEnum("condition_rank").default('unknown').notNull(),
  priceCents: integer("price_cents").notNull(),
  url: text("url").notNull(),
  seenAt: timestamp("seen_at", { withTimezone: true }).defaultNow().notNull(),
});

export const magicTokens = pgTable("magic_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  used: boolean("used").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});