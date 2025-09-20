import { pgTable, uuid, text, serial, integer, timestamp, boolean, customType, jsonb } from 'drizzle-orm/pg-core';
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


// user-defined PG types
const retailer_t = customType<{ data: string; driverData: string }>({
  dataType: () => 'retailer_t',
});

const cond_rank_t = customType<{ data: string; driverData: string }>({
  dataType: () => 'cond_rank_t',
});

export const watches = pgTable('watches', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id'),                                  // nullable
  retailer: retailer_t('retailer').notNull(),
  sku: text('sku'),                                          // nullable
  product_url: text('product_url'),                           // nullable; we will omit in inserts
  keywords: text('keywords').array(),                         // text[] nullable
  zipcode: text('zipcode'),
  radius_miles: integer('radius_miles'),
  stores: text('stores').array(),                             // text[] nullable
  price_ceiling_cents: integer('price_ceiling_cents'),
  min_condition: cond_rank_t('min_condition').notNull(),
  verified: boolean('verified').notNull().default(false),
  active: boolean('active').notNull(),                        // no default shown in UI → required in inserts
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const watchesRelations = relations(watches, ({ one }) => ({
  user: one(users, {
    fields: [watches.user_id],
    references: [users.id],
  }),
}));

export type Watch = typeof watches.$inferSelect;
export type NewWatch = typeof watches.$inferInsert;

export const inventory = pgTable('inventory', {
  // use serial so TS doesn’t require id on insert.
  // if your DB column isn’t identity yet, keep your earlier ALTER TABLE to add it.
  id: serial('id').primaryKey(),
  retailer: retailer_t('retailer').notNull(),
  store_id: text('store_id').notNull(),
  sku: text('sku'),
  title: text('title').notNull(),
  condition_label: text('condition_label').notNull(),
  condition_rank: cond_rank_t('condition_rank').notNull(),
  price_cents: integer('price_cents').notNull(),
  url: text('url').notNull(),
  seen_at: timestamp('seen_at', { withTimezone: true }).notNull(),
  image_url: text('image_url'),
  // Best Buy TTL fields
  source: text('source').notNull().default('microcenter'),
  channel: text('channel').notNull().default('store'),
  confidence: text('confidence').notNull().default('scrape'),
  fetched_at: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
  expires_at: timestamp('expires_at', { withTimezone: true }),
});

export type Inventory = typeof inventory.$inferSelect;
export type NewInventory = typeof inventory.$inferInsert;

export const stores = pgTable(
  'stores',
  {
    retailer: retailer_t('retailer').notNull(),
    store_id: text('store_id').notNull(),
    name: text('name').notNull(),
    lat: integer('lat'),      // nullable
    lng: integer('lng'),      // nullable
    zipcode: text('zipcode'), // nullable
    city: text('city'),       // nullable
    state: text('state'),     // nullable
  }
  // If your Postgres table uses a composite PK (retailer, store_id),
  // and you want Drizzle to know about it, uncomment this block:
  // ,
  // (t) => ({
  //   pk: primaryKey({ columns: [t.retailer, t.store_id] }),
  // })
);

export type Store = typeof stores.$inferSelect;
export type NewStore = typeof stores.$inferInsert;

// Optional append-only history for price points
export const price_history = pgTable('price_history', {
  id: serial('id').primaryKey(),
  retailer: text('retailer').notNull(),
  store_id: text('store_id'),
  sku: text('sku'),
  url: text('url'),
  price_cents: integer('price_cents').notNull(),
  seen_at: timestamp('seen_at', { withTimezone: true }).notNull().defaultNow(),
});

export type PriceHistory = typeof price_history.$inferSelect;
export type NewPriceHistory = typeof price_history.$inferInsert;

// Alerts ledger (optional; enable via manual SQL in prod)
export const alert_events = pgTable('alert_events', {
  id: serial('id').primaryKey(),
  watch_id: uuid('watch_id'),
  inventory_id: integer('inventory_id'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type AlertEvent = typeof alert_events.$inferSelect;

// Deal votes (optional, for community signal)
export const deal_votes = pgTable('deal_votes', {
  id: serial('id').primaryKey(),
  inventory_id: integer('inventory_id').notNull(),
  voter_hash: text('voter_hash').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type DealVote = typeof deal_votes.$inferSelect;

export const bb_store_availability = pgTable('bb_store_availability', {
  id: serial('id').primaryKey(),
  sku: text('sku').notNull(),
  zip: text('zip').notNull(),
  stores: jsonb('stores').$type<Record<string, unknown>[]>().notNull(),
  refreshed_at: timestamp('refreshed_at', { withTimezone: true }).notNull().defaultNow(),
  failed: boolean('failed').notNull().default(false),
});

export type BestBuyStoreAvailability = typeof bb_store_availability.$inferSelect;
