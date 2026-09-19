import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { can } from '@/lib/rbac';

/**
 * Verifica sessão + permissão de seção para uma API route.
 * Retorna { session } em caso de sucesso, ou { error } (NextResponse pronta
 * para ser retornada) em caso de falha.
 */
export async function requireSection(section) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return { error: NextResponse.json({ error: 'Não autenticado.' }, { status: 401 }) };
  }

  if (!can(session.user.role, section)) {
    return {
      error: NextResponse.json({ error: 'Você não tem permissão para esta ação.' }, { status: 403 }),
    };
  }

  return { session };
}

export function badRequest(message) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function notFound(message = 'Registro não encontrado.') {
  return NextResponse.json({ error: message }, { status: 404 });
}
