import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import AppShell from '@/components/AppShell';

export default async function AppLayout({ children }) {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  return <AppShell user={session.user}>{children}</AppShell>;
}
