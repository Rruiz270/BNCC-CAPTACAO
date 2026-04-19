'use server';

import { signOut } from '@/lib/auth';

/**
 * Signout server action — chamado por um <form action={signOutAction}> no sidebar.
 * Redireciona para /login depois de limpar a sessão JWT (cookie).
 */
export async function signOutAction() {
  await signOut({ redirectTo: '/login' });
}
