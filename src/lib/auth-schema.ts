/**
 * Shared identity schema — owned by the i10 CRM project.
 *
 * The BNCC-CAPTACAO project READS from the same Neon database as the CRM
 * but lives in its own Drizzle package (different `schema.ts`). To wire
 * NextAuth/DrizzleAdapter here, we declare the `crm.*` tables as references
 * pointing at existing tables (no CREATE runs from this file — the CRM's
 * migrations already created them).
 *
 * Do not add columns here — add them in the CRM project and run the migration
 * on the shared DB. This file is purely a type handle for Drizzle.
 */
import {
  pgSchema,
  text,
  integer,
  boolean,
  timestamp,
  primaryKey,
} from 'drizzle-orm/pg-core';

export const crmSchema = pgSchema('crm');

export const users = crmSchema.table('users', {
  id: text('id').primaryKey(),
  name: text('name'),
  email: text('email').notNull().unique(),
  emailVerified: timestamp('email_verified', { mode: 'date' }),
  image: text('image'),
  role: text('role').notNull().default('consultor'),
  googleRefreshToken: text('google_refresh_token'),
  isActive: boolean('is_active').default(true),
  passwordHash: text('password_hash'),
  approvalStatus: text('approval_status').notNull().default('approved'),
  displayName: text('display_name'),
  phone: text('phone'),
  signature: text('signature'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const accounts = crmSchema.table(
  'accounts',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const sessions = crmSchema.table('sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
});

export const verificationTokens = crmSchema.table(
  'verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { mode: 'date' }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);
