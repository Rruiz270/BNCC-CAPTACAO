import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthError } from 'next-auth';
import { signIn, auth } from '@/lib/auth';

function isNextRedirectError(err: unknown): boolean {
  return (
    !!err &&
    typeof err === 'object' &&
    'digest' in err &&
    typeof (err as { digest?: unknown }).digest === 'string' &&
    (err as { digest: string }).digest.startsWith('NEXT_REDIRECT')
  );
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect('/');

  const { callbackUrl, error } = await searchParams;
  const safeCallback = callbackUrl ?? '/';

  async function doGoogleSignIn() {
    'use server';
    try {
      await signIn('google', { redirectTo: safeCallback });
    } catch (err) {
      if (isNextRedirectError(err)) throw err;
      if (err instanceof AuthError) {
        redirect(`/login?error=${err.type}`);
      }
      throw err;
    }
  }

  async function doCredentialsSignIn(formData: FormData) {
    'use server';
    const email = String(formData.get('email') ?? '').trim();
    const password = String(formData.get('password') ?? '');
    try {
      await signIn('credentials', {
        email,
        password,
        redirectTo: safeCallback,
      });
    } catch (err) {
      if (isNextRedirectError(err)) throw err;
      if (err instanceof AuthError) {
        redirect(`/login?error=${err.type}`);
      }
      throw err;
    }
  }

  return (
    <div className="min-h-screen flex items-stretch bg-slate-50">
      {/* Lado esquerdo — hero gradient */}
      <div
        className="hidden md:flex md:w-1/2 relative overflow-hidden items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #061840 0%, #0A2463 100%)' }}
      >
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(60deg, transparent, transparent 40px, rgba(255,255,255,0.5) 40px, rgba(255,255,255,0.5) 41px)',
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 20% 50%, rgba(0,180,216,0.18) 0%, transparent 50%), radial-gradient(circle at 80% 30%, rgba(0,229,160,0.12) 0%, transparent 40%)',
          }}
        />

        <div className="relative max-w-sm px-10 text-white">
          <div
            className="text-[11px] font-bold uppercase mb-4"
            style={{ color: '#00B4D8', letterSpacing: '3px' }}
          >
            Instituto i10 · BNCC-CAPTACAO
          </div>
          <span className="font-extrabold tracking-tight leading-none text-7xl">
            <span style={{ color: '#FFFFFF' }}>i</span>
            <span style={{ color: '#00B4D8' }}>10</span>
          </span>
          <div
            className="mt-6 h-1 w-16 rounded-full"
            style={{ background: 'linear-gradient(90deg, #00B4D8 0%, #00E5A0 100%)' }}
          />
          <p
            className="mt-8 text-lg leading-relaxed"
            style={{ fontFamily: 'Georgia, serif', color: 'rgba(255,255,255,0.82)' }}
          >
            Auditoria FUNDEB, diagnóstico VAAT/VAAR, planos de ação e
            relatórios baseados em dados oficiais. Ambiente de execução das
            consultorias originadas no i10 CRM.
          </p>
        </div>
      </div>

      {/* Lado direito — form */}
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-slate-200 p-8">
          <div className="text-center mb-6">
            <div className="md:hidden mb-4 flex justify-center">
              <span className="font-extrabold tracking-tight text-5xl">
                <span style={{ color: '#0A2463' }}>i</span>
                <span style={{ color: '#00B4D8' }}>10</span>
              </span>
            </div>
            <h1 className="text-2xl font-bold" style={{ color: '#0A2463' }}>
              Entrar
            </h1>
            <p className="text-sm text-slate-500 mt-2">
              Use o mesmo login do i10 CRM — mesma conta serve os 2 sistemas.
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-md bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800">
              {error === 'CredentialsSignin'
                ? 'Email ou senha incorretos, ou cadastro ainda não aprovado.'
                : error}
            </div>
          )}

          <form action={doCredentialsSignIn} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm"
                placeholder="fulano@i10.org"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Senha</label>
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              className="w-full text-white font-semibold rounded-md py-2.5 transition-colors"
              style={{ background: '#0A2463' }}
            >
              Entrar com email
            </button>
          </form>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-3 bg-white text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                ou
              </span>
            </div>
          </div>

          <form action={doGoogleSignIn}>
            <button
              type="submit"
              className="w-full font-medium rounded-md py-2.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700"
            >
              <span className="inline-flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                  <path fill="#4285F4" d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087c1.7018-1.5668 2.6836-3.874 2.6836-6.615z"/>
                  <path fill="#34A853" d="M9 18c2.43 0 4.4673-.806 5.9564-2.1805l-2.9087-2.2581c-.806.54-1.8368.859-3.0477.859-2.344 0-4.3282-1.5831-5.036-3.7104H.9573v2.3318C2.4382 15.9831 5.4818 18 9 18z"/>
                  <path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.2823-1.1168-.2823-1.71s.1023-1.17.2823-1.71V4.9582H.9573C.3477 6.1731 0 7.5477 0 9s.3477 2.8268.9573 4.0418L3.964 10.71z"/>
                  <path fill="#EA4335" d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5814C13.4632.8918 11.426 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.964 7.29C4.6718 5.1627 6.656 3.5795 9 3.5795z"/>
                </svg>
                Entrar com Google (Workspace i10)
              </span>
            </button>
          </form>

          <div className="mt-8 border-t border-slate-100 pt-5 text-xs text-slate-500 space-y-1">
            <p>
              Não tem conta?{' '}
              <Link
                href="https://i10-audit-crm.vercel.app/signup"
                className="font-semibold"
                style={{ color: '#0096C7' }}
              >
                Cadastre-se no CRM
              </Link>
              {' '}— o mesmo login vale aqui.
            </p>
            <p
              className="mt-3 font-semibold uppercase"
              style={{ color: '#0A2463', letterSpacing: '2px' }}
            >
              Auditoria pública baseada em evidências.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
