/**
 * Pure client-safe role helpers. No imports from auth.ts or DB modules.
 * Used by client components (sidebar, buttons) that only need to know
 * "is this user admin?" without importing bcrypt/drizzle into the client bundle.
 */

export const ADMIN_ROLES = ['admin', 'gestor'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export function isAdmin(role: string | null | undefined): boolean {
  return typeof role === 'string' && (ADMIN_ROLES as readonly string[]).includes(role);
}
