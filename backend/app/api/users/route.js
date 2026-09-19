import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { query, genId } from '@/lib/db';
import { SECTIONS, assertCan } from '@/lib/rbac';

const createUserSchema = z.object({
  name: z.string().min(2, 'Informe o nome completo.'),
  email: z.string().email('E-mail inválido.'),
  password: z.string().min(8, 'A senha deve ter no mínimo 8 caracteres.'),
  role: z.enum(['ADMIN', 'MANAGER', 'EMPLOYEE', 'FINANCE']),
  phone: z.string().optional().nullable(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  try {
    assertCan(session?.user?.role, SECTIONS.USERS);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 403 });
  }

  const { rows: users } = await query(
    `SELECT id, name, email, role, status, phone, last_login_at AS "lastLoginAt", created_at AS "createdAt"
     FROM users
     WHERE deleted_at IS NULL
     ORDER BY created_at ASC`
  );

  return NextResponse.json({ users });
}

export async function POST(request) {
  const session = await getServerSession(authOptions);
  try {
    assertCan(session?.user?.role, SECTIONS.USERS);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 403 });
  }

  const body = await request.json();
  const parsed = createUserSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const { name, email, password, role, phone } = parsed.data;
  const normalizedEmail = email.trim().toLowerCase();

  const { rows: existingRows } = await query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
  if (existingRows.length > 0) {
    return NextResponse.json({ error: 'Já existe um usuário com este e-mail.' }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const id = genId();

  const { rows } = await query(
    `INSERT INTO users (id, name, email, password_hash, role, phone)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, name, email, role, status, created_at AS "createdAt"`,
    [id, name, normalizedEmail, passwordHash, role, phone || null]
  );
  const user = rows[0];

  await query(
    `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, new_data, description)
     VALUES ($1, $2, 'CREATE', 'User', $3, $4, $5)`,
    [
      genId(),
      session.user.id,
      user.id,
      JSON.stringify({ name: user.name, email: user.email, role: user.role }),
      `${session.user.name} criou o usuário ${user.name} (${user.role}).`,
    ]
  );

  return NextResponse.json({ user }, { status: 201 });
}
