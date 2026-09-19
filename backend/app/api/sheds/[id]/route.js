import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, genId } from '@/lib/db';
import { SECTIONS } from '@/lib/rbac';
import { requireSection, badRequest, notFound } from '@/lib/apiAuth';

const updateSchema = z.object({
  code: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  capacity: z.coerce.number().int().positive().optional(),
  location: z.string().optional().nullable(),
  type: z.string().optional().nullable(),
  status: z.enum(['ACTIVE', 'MAINTENANCE', 'INACTIVE']).optional(),
  notes: z.string().optional().nullable(),
});

const COLUMN_BY_FIELD = {
  code: 'code',
  name: 'name',
  capacity: 'capacity',
  location: 'location',
  type: 'type',
  status: 'status',
  notes: 'notes',
};

export async function PATCH(request, { params: __p }) {
  const params = await __p;
  const { session, error } = await requireSection(SECTIONS.PRODUCTION);
  if (error) return error;

  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error.errors[0].message);

  const { rows: existingRows } = await query('SELECT * FROM sheds WHERE id = $1', [params.id]);
  const existing = existingRows[0];
  if (!existing || existing.deleted_at) return notFound('Galpão não encontrado.');

  const entries = Object.entries(parsed.data);
  if (entries.length === 0) {
    return NextResponse.json({ shed: existing });
  }

  const fields = [];
  const values = [];
  let i = 1;
  for (const [key, value] of entries) {
    fields.push(`${COLUMN_BY_FIELD[key]} = $${i}`);
    values.push(value);
    i += 1;
  }
  fields.push('updated_at = now()');
  values.push(params.id);

  const { rows } = await query(
    `UPDATE sheds SET ${fields.join(', ')} WHERE id = $${i}
     RETURNING id, code, name, capacity, location, type, status, notes`,
    values
  );
  const shed = rows[0];

  await query(
    `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, previous_data, new_data, description)
     VALUES ($1, $2, 'UPDATE', 'Shed', $3, $4, $5, $6)`,
    [
      genId(),
      session.user.id,
      shed.id,
      JSON.stringify(existing),
      JSON.stringify(parsed.data),
      `${session.user.name} atualizou o galpão ${shed.name}.`,
    ]
  );

  return NextResponse.json({ shed });
}

export async function DELETE(request, { params: __p }) {
  const params = await __p;
  const { session, error } = await requireSection(SECTIONS.PRODUCTION);
  if (error) return error;

  const { rows: existingRows } = await query('SELECT * FROM sheds WHERE id = $1', [params.id]);
  const existing = existingRows[0];
  if (!existing || existing.deleted_at) return notFound('Galpão não encontrado.');

  const { rows: countRows } = await query(
    `SELECT COUNT(*)::int AS count FROM flocks WHERE shed_id = $1 AND status = 'ACTIVE'`,
    [params.id]
  );
  if (countRows[0].count > 0) {
    return badRequest('Não é possível excluir um galpão com lotes ativos. Encerre ou transfira os lotes primeiro.');
  }

  await query('UPDATE sheds SET deleted_at = now(), updated_at = now() WHERE id = $1', [params.id]);

  await query(
    `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, previous_data, description)
     VALUES ($1, $2, 'DELETE', 'Shed', $3, $4, $5)`,
    [genId(), session.user.id, params.id, JSON.stringify(existing), `${session.user.name} excluiu o galpão ${existing.name}.`]
  );

  return NextResponse.json({ message: 'Galpão excluído.' });
}
