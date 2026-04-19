import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { Sidebar } from '@/components/sidebar';
import { Providers } from '@/components/providers';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Defesa em profundidade: proxy.ts já redireciona não-autenticados, mas este
  // guard evita que código do (app) rode se o proxy passar por algum edge-case.
  const session = await auth();
  if (!session?.user) redirect('/login');

  const user = session.user as typeof session.user & { role?: string };
  const userProps = {
    name: user.name ?? null,
    email: user.email ?? '',
    role: user.role ?? 'consultor',
  };

  return (
    <Providers>
      <div className="flex min-h-screen">
        <Sidebar user={userProps} />
        <main className="flex-1 ml-64 min-h-screen bg-[var(--bg)]">
          {children}
        </main>
      </div>
    </Providers>
  );
}
