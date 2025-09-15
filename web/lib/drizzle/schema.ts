import { pgTable, uuid, text, serial, integer, timestamp, boolean, customType } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const magicTokens = pgTable('magic_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  email: text('email').notNull(),
  token: text('token').notNull().unique(), // stored plaintext for now (can upgrade to hash later)
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  used: boolean('used').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  tokens: many(magicTokens),
}));


const retailerT = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'retailer_t';
  },
});

const condRankT = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'cond_rank_t';
  },
});

/**
 * watches
 * Columns (per Supabase UI):
 *  id (uuid, PK, not null)
 *  user_id (uuid, nullable)
 *  retailer (retailer_t, not null)
 *  sku (text, nullable)
 *  product_url (text, nullable)
 *  keywords (text[], nullable)
 *  zipcode (text, nullable)
 *  radius_miles (int4, nullable)
 *  stores (text[], nullable)
 *  price_ceiling_cents (int4, nullable)
 *  min_condition (cond_rank_t, not null)
 *  active (bool, not null)
 *  created_at (timestamptz, not null)
 */
export const watches = pgTable('watches', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id'), // nullable in your screenshot
  retailer: retailerT('retailer').notNull(),
  sku: text('sku'), // nullable
  productUrl: text('product_url'),
  keywords: text('keywords').array(), // text[]
  zipcode: text('zipcode'),
  radiusMiles: integer('radius_miles'),
  stores: text('stores').array(), // text[]
  priceCeilingCents: integer('price_ceiling_cents'),
  minCondition: condRankT('min_condition').notNull(),
  active: boolean('active').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const watchesRelations = relations(watches, ({ one }) => ({
  user: one(users, {
    fields: [watches.userId],
    references: [users.id],
  }),
}));

export type Watch = typeof watches.$inferSelect;
export type NewWatch = typeof watches.$inferInsert;

/**
 * inventory
 * Columns (per Supabase UI):
 *  id (int4, not null)        ← not marking PK here since UI didn’t show it; adjust if needed
 *  retailer (retailer_t, not null)
 *  store_id (text, not null)
 *  sku (text, nullable)
 *  title (text, not null)
 *  condition_label (text, not null)
 *  condition_rank (cond_rank_t, not null)
 *  price_cents (int4, not null)
 *  url (text, not null)
 *  seen_at (timestamptz, not null)
 */
export const inventory = pgTable('inventory', {
  id: serial('id').primaryKey(),
  retailer: retailerT('retailer').notNull(),
  storeId: text('store_id').notNull(),
  sku: text('sku'),
  title: text('title').notNull(),
  conditionLabel: text('condition_label').notNull(),
  conditionRank: condRankT('condition_rank').notNull(),
  priceCents: integer('price_cents').notNull(),
  url: text('url').notNull(),
  seenAt: timestamp('seen_at', { withTimezone: true }).notNull(),
});

export type Inventory = typeof inventory.$inferSelect;
export type NewInventory = typeof inventory.$inferInsert;
