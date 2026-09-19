import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { query, genId } from '@/lib/db';
import { SECTIONS, assertCan } from '@/lib/rbac';

const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  role: z.enum(['ADMIN', 'MANAGER', 'EMPLOYEE', 'FINANCE']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  phone: z.string().optional().nullable(),
  password: z.string().min(8).optional(),
});

export async function PATCH(request, { params: __p }) {
  const params = await __p;
  const session = await getServerSession(authOptions);
  try {
    assertCan(session?.user?.role, SECTIONS.USERS);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 403 });
  }

  const { id } = params;
  const body = await request.json();
  const parsed = updateUserSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const { rows: existingRows } = await query('SELECT * FROM users WHERE id = $1', [id]);
  const existingUser = existingRows[0];
  if (!existingUser || existingUser.deleted_at) {
    return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
  }

  if (id === session.user.id && parsed.data.role && parsed.data.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'Você não pode remover seu próprio nível de administrador.' },
      { status: 400 }
    );
  }

  if (id === session.user.id && parsed.data.status === 'INACTIVE') {
    return NextResponse.json({ error: 'Você não pode desativar sua própria conta.' }, { status: 400 });
  }

  const { password, ...rest } = parsed.data;

  // Monta um UPDATE dinâmico apenas com os campos enviados (equivalente ao
  // Prisma receber um objeto parcial em `data`).
  const fields = [];
  const values = [];
  let i = 1;
  for (const [key, value] of Object.entries(rest)) {
    const column = { name: 'name', role: 'role', status: 'status', phone: 'phone' }[key];
    fields.push(`${column} = $${i}`);
    values.push(value);
    i += 1;
  }
  if (password) {
    fields.push(`password_hash = $${i}`);
    values.push(await bcrypt.hash(password, 12));
    i += 1;
  }
  fields.push(`updated_at = now()`);
  values.push(id);

  const { rows: updatedRows } = await query(
    `UPDATE users SET ${fields.join(', ')} WHERE id = $${i}
     RETURNING id, name, email, role, status, phone`,
    values
  );
  const updatedUser = updatedRows[0];

  await query(
    `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, previous_data, new_data, description)
     VALUES ($1, $2, 'UPDATE', 'User', $3, $4, $5, $6)`,
    [
      genId(),
      session.user.id,
      id,
      JSON.stringify({ name: existingUser.name, role: existingUser.role, status: existingUser.status }),
      JSON.stringify({ name: updatedUser.name, role: updatedUser.role, status: updatedUser.status }),
      `${session.user.name} atualizou o usuário ${updatedUser.name}.`,
    ]
  );

  return NextResponse.json({ user: updatedUser });
}

export async function DELETE(request, { params: __p }) {
  const params = await __p;
  const session = await getServerSession(authOptions);
  try {
    assertCan(session?.user?.role, SECTIONS.USERS);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 403 });
  }

  const { id } = params;

  if (id === session.user.id) {
    return NextResponse.json({ error: 'Você não pode excluir sua própria conta.' }, { status: 400 });
  }

  const { rows: existingRows } = await query('SELECT * FROM users WHERE id = $1', [id]);
  const existingUser = existingRows[0];
  if (!existingUser || existingUser.deleted_at) {
    return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
  }

  // Soft delete: preserva o histórico/auditoria vinculado a este usuário.
  await query(
    `UPDATE users SET deleted_at = now(), status = 'INACTIVE', updated_at = now() WHERE id = $1`,
    [id]
  );

  await query(
    `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, previous_data, description)
     VALUES ($1, $2, 'DELETE', 'User', $3, $4, $5)`,
    [
      genId(),
      session.user.id,
      id,
      JSON.stringify({ name: existingUser.name, email: existingUser.email }),
      `${session.user.name} excluiu (desativou) o usuário ${existingUser.name}.`,
    ]
  );

  return NextResponse.json({ message: 'Usuário excluído com sucesso.' });
}
