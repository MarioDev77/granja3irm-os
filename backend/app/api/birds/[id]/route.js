import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, genId } from '@/lib/db';
import { SECTIONS } from '@/lib/rbac';
import { requireSection, badRequest, notFound } from '@/lib/apiAuth';

const updateSchema = z.object({
  identifier: z.string().min(1).optional(),
  sex: z.enum(['MALE', 'FEMALE', 'UNKNOWN']).optional(),
  breed: z.string().optional().nullable(),
  status: z.enum(['ACTIVE', 'SOLD', 'DEAD', 'DISCARDED', 'TRANSFERRED']).optional(),
  flockId: z.string().optional(),
});

const COLUMN_BY_FIELD = {
  identifier: 'identifier',
  sex: 'sex',
  breed: 'breed',
  status: 'status',
  flockId: 'flock_id',
};

export async function PATCH(request, { params: __p }) {
  const params = await __p;
  const { session, error } = await requireSection(SECTIONS.PRODUCTION);
  if (error) return error;

  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error.errors[0].message);

  const { rows: existingRows } = await query('SELECT * FROM birds WHERE id = $1', [params.id]);
  const existing = existingRows[0];
  if (!existing) return notFound('Ave não encontrada.');

  const entries = Object.entries(parsed.data);
  if (entries.length === 0) {
    return NextResponse.json({ bird: existing });
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
    `UPDATE birds SET ${fields.join(', ')} WHERE id = $${i}
     RETURNING id, identifier, status, flock_id AS "flockId"`,
    values
  );
  const bird = rows[0];

  await query(
    `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, previous_data, new_data, description)
     VALUES ($1, $2, 'UPDATE', 'Bird', $3, $4, $5, $6)`,
    [
      genId(), session.user.id, bird.id,
      JSON.stringify({ status: existing.status }),
      JSON.stringify(parsed.data),
      `${session.user.name} atualizou a ave ${bird.identifier} para o status ${bird.status}.`,
    ]
  );

  return NextResponse.json({ bird });
}
