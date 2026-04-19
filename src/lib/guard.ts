import { NextResponse } from 'next/server';
import { auth } from './auth';
import { isAdmin } from './roles';

/**
 * Guard para route handlers (/api/*). Usa em cima de qualquer handler que
 * precisa de auth/admin. Retorna NextResponse no caso de falha, ou `null` no sucesso.
 *
 * Uso:
 *   const gate = await requireAdminApi();
 *   if (gate) return gate;
 *   // ... lógica admin-only
 */
export async function requireAuthApi(): Promise<NextResponse | null> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  return null;
}

export async function requireAdminApi(): Promise<NextResponse | null> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  const role = (session.user as typeof session.user & { role?: string }).role;
  if (!isAdmin(role)) {
    return NextResponse.json(
      { error: 'FORBIDDEN', message: 'Requer role admin ou gestor' },
      { status: 403 },
    );
  }
  return null;
}

/**
 * Retorna apenas o `session.user` já tipado com role. Para route handlers que
 * precisam saber QUEM está fazendo a operação (ex: audit log).
 */
export async function getApiUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    email: session.user.email ?? '',
    name: session.user.name ?? null,
    role: (session.user as typeof session.user & { role?: string }).role ?? 'consultor',
  };
}
