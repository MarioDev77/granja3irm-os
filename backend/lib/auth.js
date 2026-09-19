import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { query, genId } from '@/lib/db';

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

        const { rows } = await query('SELECT * FROM users WHERE email = $1', [email]);
        const user = rows[0];

        // Mesma mensagem genérica em todos os casos de falha, para não
        // revelar se o e-mail existe ou não na base (evita enumeração).
        const genericError = 'E-mail ou senha inválidos.';

        if (!user || user.status !== 'ACTIVE' || user.deleted_at) {
          throw new Error(genericError);
        }

        if (user.locked_until && new Date(user.locked_until) > new Date()) {
          const minutesLeft = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
          throw new Error(
            `Conta temporariamente bloqueada por excesso de tentativas. Tente novamente em ${minutesLeft} min.`
          );
        }

        const passwordMatches = await bcrypt.compare(password, user.password_hash);

        if (!passwordMatches) {
          const failedLoginAttempts = user.failed_login_attempts + 1;
          const shouldLock = failedLoginAttempts >= MAX_FAILED_ATTEMPTS;

          await query(
            `UPDATE users SET failed_login_attempts = $1, locked_until = $2, updated_at = now()
             WHERE id = $3`,
            [
              shouldLock ? 0 : failedLoginAttempts,
              shouldLock ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) : user.locked_until,
              user.id,
            ]
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

        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
