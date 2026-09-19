import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, genId } from '@/lib/db';
import { SECTIONS, ROLES } from '@/lib/rbac';
import { requireSection, badRequest, notFound } from '@/lib/apiAuth';

const updateSchema = z.object({
  goodEggs: z.coerce.number().int().min(0).optional(),
  brokenEggs: z.coerce.number().int().min(0).optional(),
  dirtyEggs: z.coerce.number().int().min(0).optional(),
  discardedEggs: z.coerce.number().int().min(0).optional(),
  notes: z.string().optional().nullable(),
});

const COLUMN_BY_FIELD = {
  goodEggs: 'good_eggs',
  brokenEggs: 'broken_eggs',
  dirtyEggs: 'dirty_eggs',
  discardedEggs: 'discarded_eggs',
  notes: 'notes',
};

export async function PATCH(request, { params: __p }) {
  const params = await __p;
  const { session, error } = await requireSection(SECTIONS.PRODUCTION);
  if (error) return error;

  const { rows: existingRows } = await query('SELECT * FROM egg_productions WHERE id = $1', [params.id]);
  const existing = existingRows[0];
  if (!existing) return notFound('Registro não encontrado.');

  // Funcionários só podem corrigir os próprios registros; Gerente/Admin
  // podem corrigir qualquer um.
  const isOwner = existing.responsible_id === session.user.id;
  const isPrivileged = [ROLES.ADMIN, ROLES.MANAGER].includes(session.user.role);
  if (!isOwner && !isPrivileged) {
    return NextResponse.json(
      { error: 'Você só pode editar registros que você mesmo lançou.' },
      { status: 403 }
    );
  }

  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error.errors[0].message);

  const entries = Object.entries(parsed.data);
  if (entries.length === 0) {
    return NextResponse.json({ record: existing });
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
    `UPDATE egg_productions SET ${fields.join(', ')} WHERE id = $${i}
     RETURNING id, date, flock_id AS "flockId", good_eggs AS "goodEggs", broken_eggs AS "brokenEggs",
       dirty_eggs AS "dirtyEggs", discarded_eggs AS "discardedEggs", notes`,
    values
  );
  const record = rows[0];

  await query(
    `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, previous_data, new_data, description)
     VALUES ($1, $2, 'UPDATE', 'EggProduction', $3, $4, $5, $6)`,
    [
      genId(), session.user.id, record.id,
      JSON.stringify({
        goodEggs: existing.good_eggs, brokenEggs: existing.broken_eggs,
        dirtyEggs: existing.dirty_eggs, discardedEggs: existing.discarded_eggs,
      }),
      JSON.stringify(parsed.data),
      `${session.user.name} corrigiu um registro de produção de ovos.`,
    ]
  );

  return NextResponse.json({ record });
}
