import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { authDb } from './auth-db';
import { users, accounts, sessions, verificationTokens } from './auth-schema';
import authConfig from './auth.config';

/**
 * SSO com o CRM: leitura e comparação de senha contra `crm.users`.
 * Nenhum usuário é criado aqui — onboarding acontece no CRM ou via admin-created.
 * O BNCC só autentica quem JÁ EXISTE com approval_status='approved'.
 */

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

async function findActiveApprovedUserByEmail(email: string) {
  const row = await authDb.query.users.findFirst({
    where: eq(users.email, email),
  });
  if (!row) return null;
  if (!row.isActive) return { status: 'inactive' as const, user: row };
  if (row.approvalStatus !== 'approved') {
    return { status: row.approvalStatus as 'pending' | 'rejected', user: row };
  }
  return { status: 'ok' as const, user: row };
}

const adminEmails = (process.env.ADMIN_EMAILS ?? '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(authDb, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    ...authConfig.providers,
    Credentials({
      id: 'credentials',
      name: 'Email e senha',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Senha', type: 'password' },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;
        const result = await findActiveApprovedUserByEmail(email);
        if (!result) return null;
        if (result.status !== 'ok') return null;
        const u = result.user;
        if (!u.passwordHash) return null;
        const valid = await bcrypt.compare(password, u.passwordHash);
        if (!valid) return null;
        return {
          id: u.id,
          email: u.email,
          name: u.displayName ?? u.name ?? null,
          image: u.image ?? null,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      if (account?.provider === 'credentials') return true;
      if (!user?.email) return false;
      const email = user.email.toLowerCase();
      const result = await findActiveApprovedUserByEmail(email);
      // Admin allowlist: promove email listado no env var mesmo se ainda não existe
      if (adminEmails.includes(email)) {
        if (result) {
          await authDb
            .update(users)
            .set({ role: 'admin', isActive: true, approvalStatus: 'approved' })
            .where(eq(users.email, email));
        }
        return true;
      }
      if (!result) return false;
      if (result.status !== 'ok') return false;
      return true;
    },
    async jwt({ token, user, trigger }) {
      if (user?.email) {
        const fresh = await authDb.query.users.findFirst({
          where: eq(users.email, user.email as string),
        });
        if (fresh) {
          token.id = fresh.id;
          token.role = fresh.role;
          token.isActive = !!fresh.isActive;
          token.approvalStatus = fresh.approvalStatus;
        }
      } else if (trigger === 'update' || !token.role) {
        if (token.email) {
          const fresh = await authDb.query.users.findFirst({
            where: eq(users.email, token.email as string),
          });
          if (fresh) {
            token.id = fresh.id;
            token.role = fresh.role;
            token.isActive = !!fresh.isActive;
            token.approvalStatus = fresh.approvalStatus;
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        (session.user as typeof session.user & { id?: string }).id =
          (token.id as string) ?? token.sub;
        (session.user as typeof session.user & { role?: string }).role =
          (token.role as string) ?? 'consultor';
      }
      return session;
    },
  },
});
