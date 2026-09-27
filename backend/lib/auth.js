import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { query, genId } from '@/lib/db';
import { checkRateLimit } from '@/lib/rateLimit';

if (
  process.env.NODE_ENV === 'production' &&
  (!process.env.NEXTAUTH_SECRET || process.env.NEXTAUTH_SECRET.length < 32 ||
    process.env.NEXTAUTH_SECRET.includes('troque-por-um-segredo'))
) {
  throw new Error('NEXTAUTH_SECRET deve ser um segredo aleatório com pelo menos 32 caracteres em produção.');
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export const authOptions = {
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 horas — renovado a cada requisição autenticada
  },
  pages: {
    signIn: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'Credenciais',
      credentials: {
        email: { label: 'E-mail', type: 'email' },
        password: { label: 'Senha', type: 'password' },
      },
      async authorize(credentials) {
        const email = String(credentials?.email || '').trim().toLowerCase();
        const password = String(credentials?.password || '');

        if (!email || !password) {
          throw new Error('Informe e-mail e senha.');
        }

        if (!checkRateLimit(`login-account:${email}`, 10, 60_000).allowed) {
          throw new Error('E-mail ou senha inválidos.');
        }

        const { rows } = await query('SELECT * FROM users WHERE email = $1', [email]);
        const user = rows[0];

        // Mesma mensagem genérica em todos os casos de falha, para não
        // revelar se o e-mail existe ou não na base (evita enumeração).
        const genericError = 'E-mail ou senha inválidos.';

        if (!user || user.status !== 'ACTIVE' || user.deleted_at) {
          throw new Error(genericError);
        }

        if (user.locked_until && new Date(user.locked_until) > new Date()) {
          throw new Error(genericError);
        }

        const passwordMatches = await bcrypt.compare(password, user.password_hash);

        if (!passwordMatches) {
          await query(
            `UPDATE users
             SET failed_login_attempts = CASE
                   WHEN failed_login_attempts + 1 >= $1 THEN 0
                   ELSE failed_login_attempts + 1
                 END,
                 locked_until = CASE
                   WHEN failed_login_attempts + 1 >= $1
                     THEN now() + ($2 * interval '1 minute')
                   ELSE locked_until
                 END,
                 updated_at = now()
             WHERE id = $3`,
            [MAX_FAILED_ATTEMPTS, LOCKOUT_MINUTES, user.id]
          );

          throw new Error(genericError);
        }

        // Login bem-sucedido: zera contador de tentativas e registra acesso.
        await query(
          `UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = now(), updated_at = now()
           WHERE id = $1`,
          [user.id]
        );

        await query(
          `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, description)
           VALUES ($1, $2, 'LOGIN', 'User', $2, $3)`,
          [genId(), user.id, `${user.name} entrou no sistema.`]
        );

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          auth_version: user.auth_version,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.authVersion = user.auth_version;
      }

      // Refresh authorization from the database on every server session read.
      // This makes role/status changes effective immediately instead of
      // trusting stale role claims until the JWT expires.
      if (token.id) {
        const { rows } = await query(
          `SELECT role, status, deleted_at, auth_version
           FROM users WHERE id = $1`,
          [token.id]
        );
        const currentUser = rows[0];
        if (
          !currentUser ||
          currentUser.status !== 'ACTIVE' ||
          currentUser.deleted_at ||
          (token.authVersion != null && Number(token.authVersion) !== Number(currentUser.auth_version))
        ) {
          token.invalidated = true;
          token.role = null;
          return token;
        }
        token.authVersion = currentUser.auth_version;
        token.role = currentUser.role;
        token.invalidated = false;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.invalidated ? null : token.id;
        session.user.role = token.invalidated ? null : token.role;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
