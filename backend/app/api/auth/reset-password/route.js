import { NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query, genId, withTransaction } from '@/lib/db';

const schema = z.object({
  token: z.string().min(10).max(256),
  password: z.string().min(8, 'A senha deve ter no mínimo 8 caracteres.'),
});

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corpo da solicitação inválido.' }, { status: 400 });
  }
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const { token, password } = parsed.data;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const { rows: tokenRows } = await query(
    `SELECT * FROM password_reset_tokens WHERE token = $1 AND expires_at > now()`,
    [tokenHash]
  );
  const resetToken = tokenRows[0];

  if (!resetToken) {
    return NextResponse.json({ error: 'Link inválido ou expirado. Solicite um novo.' }, { status: 400 });
  }

  const { rows: userRows } = await query(
    `SELECT id, name FROM users
     WHERE email = $1 AND status = 'ACTIVE' AND deleted_at IS NULL`,
    [resetToken.email]
  );
  const user = userRows[0];

  if (!user) {
    return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const consumed = await withTransaction(async (client) => {
    const { rows: lockedTokens } = await client.query(
      `SELECT id FROM password_reset_tokens
       WHERE id = $1 AND expires_at > now() FOR UPDATE`,
      [resetToken.id]
    );
    if (lockedTokens.length === 0) return false;

    const { rows: activeUsers } = await client.query(
      `SELECT id FROM users WHERE id = $1 AND status = 'ACTIVE' AND deleted_at IS NULL FOR UPDATE`,
      [user.id]
    );
    if (activeUsers.length === 0) return false;

    await client.query(
      `UPDATE users SET password_hash = $1, failed_login_attempts = 0, locked_until = NULL,
         auth_version = auth_version + 1, updated_at = now()
       WHERE id = $2`,
      [passwordHash, user.id]
    );
    await client.query('DELETE FROM password_reset_tokens WHERE id = $1', [resetToken.id]);
    await client.query('DELETE FROM password_reset_tokens WHERE email = $1', [resetToken.email]);
    await client.query(
      `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, description)
       VALUES ($1, $2, 'PASSWORD_RESET', 'User', $2, $3)`,
      [genId(), user.id, `${user.name} redefiniu a própria senha.`]
    );
    return true;
  });

  if (!consumed) {
    return NextResponse.json({ error: 'Link inválido ou expirado. Solicite um novo.' }, { status: 400 });
  }

  return NextResponse.json({ message: 'Senha redefinida com sucesso. Você já pode entrar.' });
}
