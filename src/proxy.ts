import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import authConfig from '@/lib/auth.config';

// Edge-safe: usa `auth.config.ts` (sem bcrypt/Drizzle).
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl, auth: session } = req;

  // Rotas públicas — NÃO exigem login:
  //   · /login, /api/auth/* — fluxo de autenticação
  //   · (public)/intake/[token] e /acompanhamento/[token] — magic link municipal
  //   · /api/intake/[token] e /api/acompanhamento/[token] — endpoints dos tokens
  //   · Static assets, favicon
  const isPublicPath =
    nextUrl.pathname === '/login' ||
    nextUrl.pathname.startsWith('/api/auth') ||
    nextUrl.pathname.startsWith('/intake/') ||
    nextUrl.pathname.startsWith('/api/intake/') ||
    nextUrl.pathname.startsWith('/acompanhamento/') ||
    nextUrl.pathname.startsWith('/api/acompanhamento/') ||
    nextUrl.pathname.startsWith('/_next') ||
    nextUrl.pathname === '/favicon.ico';

  if (isPublicPath) return NextResponse.next();

  if (!session) {
    const url = new URL('/login', nextUrl.origin);
    url.searchParams.set('callbackUrl', nextUrl.pathname + nextUrl.search);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
