/**
 * Separate Drizzle instance for auth — reads from `crm.*` schema (shared
 * with the i10 CRM). Having it isolated from the main `db` export means
 * the rest of BNCC-CAPTACAO keeps operating against fundeb.* without
 * pulling auth tables into every query plan.
 */
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as authSchema from './auth-schema';

const url =
  process.env.DATABASE_URL ??
  'postgresql://build:build@build.placeholder.neon.tech/build?sslmode=require';

const sql = neon(url);
export const authDb = drizzle(sql, { schema: authSchema });
