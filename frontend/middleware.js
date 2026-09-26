import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { can, SECTIONS } from '@/lib/rbac';

// ============================================================================
// Middleware do FRONT-END — protege somente as PÁGINAS.
//
// Redireciona para /login quem não tem sessão e para o dashboard quem tenta
// abrir uma seção que o seu perfil não pode acessar. As rotas /api/* ficam
// de fora (ver "matcher"): elas são repassadas ao back-end, que aplica a sua
// própria autenticação e RBAC — o front nunca é a única barreira.
// ============================================================================

// Mapeia prefixos de rota para a seção do RBAC exigida.
// Rotas não listadas exigem apenas autenticação (qualquer perfil logado).
const ROUTE_SECTIONS = [
  { prefix: '/usuarios', section: SECTIONS.USERS },
  { prefix: '/configuracoes', section: SECTIONS.SETTINGS },
  { prefix: '/auditoria', section: SECTIONS.AUDIT },
  { prefix: '/galpoes', section: SECTIONS.PRODUCTION },
  { prefix: '/controle-ambiental', section: SECTIONS.PRODUCTION },
  { prefix: '/lotes', section: SECTIONS.PRODUCTION },
  { prefix: '/aves', section: SECTIONS.PRODUCTION },
  { prefix: '/producao', section: SECTIONS.PRODUCTION },
  { prefix: '/mortalidade', section: SECTIONS.PRODUCTION },
  { prefix: '/operacional', section: SECTIONS.PRODUCTION },
  { prefix: '/racoes', section: SECTIONS.STOCK },
  { prefix: '/estoque-racao', section: SECTIONS.STOCK },
  { prefix: '/consumo-racao', section: SECTIONS.STOCK },
  { prefix: '/estoque-ovos', section: SECTIONS.STOCK },
  { prefix: '/vacinacao', section: SECTIONS.HEALTH },
  { prefix: '/medicamentos', section: SECTIONS.HEALTH },
  { prefix: '/ocorrencias', section: SECTIONS.HEALTH },
  { prefix: '/vendas', section: SECTIONS.SALES },
  { prefix: '/clientes', section: SECTIONS.SALES },
  { prefix: '/compras', section: SECTIONS.PURCHASES },
  { prefix: '/fornecedores', section: SECTIONS.PURCHASES },
  { prefix: '/financeiro', section: SECTIONS.FINANCE },
  { prefix: '/fluxo-caixa', section: SECTIONS.FINANCE },
  { prefix: '/contas-pagar', section: SECTIONS.FINANCE },
  { prefix: '/contas-receber', section: SECTIONS.FINANCE },
  { prefix: '/custos', section: SECTIONS.FINANCE },
  { prefix: '/relatorios', section: SECTIONS.REPORTS },
];

const PUBLIC_PATHS = ['/login', '/recuperar-senha', '/redefinir-senha'];

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const requiredSection = ROUTE_SECTIONS.find((r) => pathname.startsWith(r.prefix))?.section;

  if (requiredSection && !can(token.role, requiredSection)) {
    return NextResponse.redirect(new URL('/dashboard?erro=acesso-negado', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Aplica o middleware a tudo, exceto /api (repassado ao back-end)
     * e arquivos estáticos do Next.
     */
    '/((?!api/|_next/static|_next/image|favicon.ico).*)',
  ],
};
