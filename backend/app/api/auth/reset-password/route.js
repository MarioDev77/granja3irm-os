import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query, genId, withTransaction } from '@/lib/db';

const schema = z.object({
  token: z.string().min(10),
  password: z.string().min(8, 'A senha deve ter no mínimo 8 caracteres.'),
});

export async function POST(request) {
  const body = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const { token, password } = parsed.data;

  const { rows: tokenRows } = await query('SELECT * FROM password_reset_tokens WHERE token = $1', [token]);
  const resetToken = tokenRows[0];

  if (!resetToken || new Date(resetToken.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Link inválido ou expirado. Solicite um novo.' }, { status: 400 });
  }

  const { rows: userRows } = await query('SELECT * FROM users WHERE email = $1', [resetToken.email]);
  const user = userRows[0];

  if (!user) {
    return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE users SET password_hash = $1, failed_login_attempts = 0, locked_until = NULL, updated_at = now()
       WHERE id = $2`,
      [passwordHash, user.id]
    );
    await client.query('DELETE FROM password_reset_tokens WHERE token = $1', [token]);
    await client.query(
      `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, description)
       VALUES ($1, $2, 'PASSWORD_RESET', 'User', $2, $3)`,
      [genId(), user.id, `${user.name} redefiniu a própria senha.`]
    );
  });

  return NextResponse.json({ message: 'Senha redefinida com sucesso. Você já pode entrar.' });
}
