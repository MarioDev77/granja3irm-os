import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { getToken } from 'next-auth/jwt';

// ============================================================================
// Sessão no front-end (uso em Server Components e layouts).
//
// A sessão é um JWT assinado pelo BACK-END (NextAuth) e guardado em cookie.
// O front-end só precisa LER esse cookie — e para isso basta o mesmo
// NEXTAUTH_SECRET, sem importar código do back-end (Prisma, bcrypt etc.).
// É exatamente o que o middleware.js já faz para proteger as páginas.
//
// Substitui o antigo getServerSession(authOptions), que exigia o lib/auth do
// back-end. O formato retornado é o mesmo: { user: { id, name, email, role } }.
// ============================================================================

export const getSession = cache(async () => {
  const token = await getToken({
    req: { cookies: await cookies(), headers: await headers() },
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) return null;

  return {
    user: {
      id: token.id,
      name: token.name ?? null,
      email: token.email ?? null,
      role: token.role,
    },
    expires: token.exp ? new Date(token.exp * 1000).toISOString() : undefined,
  };
});
