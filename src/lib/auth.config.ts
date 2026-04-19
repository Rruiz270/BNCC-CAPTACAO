import type { NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';

/**
 * Edge-safe auth config — sem imports de DB ou bcrypt.
 * Usado pelo `src/proxy.ts` (Edge runtime).
 * A config completa (com DrizzleAdapter + Credentials) está em `auth.ts`.
 */
export default {
  providers: [
    Google({
      authorization: {
        params: {
          scope: [
            'openid',
            'email',
            'profile',
            'https://www.googleapis.com/auth/calendar.events',
          ].join(' '),
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ auth }) {
      return !!auth?.user;
    },
  },
} satisfies NextAuthConfig;
