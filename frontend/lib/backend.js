import { headers } from 'next/headers';

// ============================================================================
// Cliente do back-end para uso no SERVIDOR do front-end (Server Components).
//
// No navegador, as páginas continuam chamando fetch('/api/...') normalmente:
// o next.config.mjs redireciona (rewrite) tudo que começa com /api para o
// back-end. Já aqui, no servidor, chamamos o back-end direto (BACKEND_URL) e
// repassamos o cookie de sessão do usuário para que o back-end o autentique.
// ============================================================================

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export class BackendError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'BackendError';
    this.status = status;
  }
}

export async function backendFetch(path, init = {}) {
  const cookie = (await headers()).get('cookie') ?? '';

  let response;
  try {
    response = await fetch(`${BACKEND_URL}${path}`, {
      ...init,
      cache: 'no-store',
      headers: { ...init.headers, cookie },
    });
  } catch {
    throw new BackendError(
      503,
      `Não foi possível conectar ao back-end em ${BACKEND_URL}. Ele está rodando? Confira a variável BACKEND_URL.`
    );
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new BackendError(
        401,
        'O back-end recusou a sessão (401). Confira se NEXTAUTH_SECRET e NEXTAUTH_URL são idênticos no front-end e no back-end.'
      );
    }
    const body = await response.json().catch(() => null);
    throw new BackendError(response.status, body?.error || `Erro ${response.status} ao consultar o back-end.`);
  }

  return response.json();
}
