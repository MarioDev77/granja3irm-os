import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { can, SECTIONS } from '@/lib/rbac';
import { checkRateLimit } from '@/lib/rateLimit';

// ============================================================================
// Middleware do BACK-END — protege somente as rotas /api/*.
//
// O back-end é um serviço independente: ele não pode depender de o front-end
// ter barrado a requisição antes. Por isso a autenticação e as regras de
// acesso a /api/* vivem aqui (o middleware do front-end cuida só das páginas).
// ============================================================================

// Mapeia prefixos de rota de API para a seção do RBAC exigida.
// Rotas não listadas exigem apenas autenticação (qualquer perfil logado);
// cada route handler ainda valida a sua própria seção via requireSection().
const API_ROUTE_SECTIONS = [{ prefix: '/api/users', section: SECTIONS.USERS }];

// /api/auth  -> login/logout/sessão do NextAuth (e recuperação de senha)
// /api/iot   -> sensores; autenticam com token de dispositivo na própria rota
const PUBLIC_API_PATHS = ['/api/auth', '/api/iot'];

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // Limita tentativas de login por IP, além do bloqueio por conta já feito
  // em lib/auth.js (defesa em profundidade contra brute force).
  if (pathname === '/api/auth/callback/credentials') {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const { allowed } = checkRateLimit(`login:${ip}`, 10, 60_000);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Muitas tentativas. Aguarde um minuto e tente novamente.' },
        { status: 429 }
      );
    }
  }

  if (PUBLIC_API_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const requiredSection = API_ROUTE_SECTIONS.find((r) => pathname.startsWith(r.prefix))?.section;

  if (requiredSection && !can(token.role, requiredSection)) {
    return NextResponse.json({ error: 'Acesso negado para o seu perfil.' }, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
