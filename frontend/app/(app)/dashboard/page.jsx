import { getSession } from '@/lib/session';
import { backendFetch } from '@/lib/backend';
import DashboardView from '@/components/dashboard-view';

export const dynamic = 'force-dynamic';

// Os dados do painel vêm do back-end (GET /api/dashboard). Antes, esta página
// consultava o banco diretamente; agora ela só busca o JSON pronto e o exibe.
export default async function DashboardPage({ searchParams }) {
  const session = await getSession();
  const data = await backendFetch('/api/dashboard');
  const params = await searchParams;
  const accessDenied = params?.erro === 'acesso-negado';

  return <DashboardView data={data} accessDenied={accessDenied} userName={session?.user?.name} />;
}
