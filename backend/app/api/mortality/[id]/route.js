import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, genId } from '@/lib/db';
import { SECTIONS } from '@/lib/rbac';
import { requireSection, badRequest, notFound } from '@/lib/apiAuth';

const updateSchema = z.object({
  date: z.string().min(1).optional(),
  flockId: z.string().min(1).optional(),
  quantity: z.coerce.number().int().positive().optional(),
  reason: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const RECORD_SELECT = `id, date, flock_id AS "flockId", quantity, reason, notes, responsible_id AS "responsibleId"`;

export async function PATCH(request, { params: __p }) {
  const params = await __p;
  const { session, error } = await requireSection(SECTIONS.PRODUCTION);
  if (error) return error;

  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error.errors[0].message);

  const { rows: existingRows } = await query('SELECT * FROM mortality_records WHERE id = $1', [params.id]);
  const existing = existingRows[0];
  if (!existing) return notFound('Registro de mortalidade não encontrado.');

  const { date, flockId, quantity, reason, notes } = parsed.data;
  const targetFlockId = flockId ?? existing.flock_id;

  if (flockId) {
    const { rows: flockRows } = await query('SELECT * FROM flocks WHERE id = $1', [flockId]);
    if (!flockRows[0]) return badRequest('Lote inválido.');
  }

  if (quantity !== undefined) {
    const { rows: countRows } = await query(
      `SELECT COUNT(*)::int AS count FROM birds WHERE flock_id = $1 AND status = 'ACTIVE'`,
      [targetFlockId]
    );
    const activeBirds = countRows[0].count;
    if (quantity > activeBirds && activeBirds > 0) {
      return badRequest(`O lote possui apenas ${activeBirds} aves ativas registradas.`);
    }
  }

  const { rows } = await query(
    `UPDATE mortality_records SET
       date = $1, flock_id = $2, quantity = $3, reason = $4, notes = $5, updated_at = now()
     WHERE id = $6
     RETURNING ${RECORD_SELECT}`,
    [
      date ? new Date(date) : existing.date,
      targetFlockId,
      quantity ?? existing.quantity,
      reason !== undefined ? reason : existing.reason,
      notes !== undefined ? notes : existing.notes,
      params.id,
    ]
  );
  const record = rows[0];

  await query(
    `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, previous_data, new_data, description)
     VALUES ($1, $2, 'UPDATE', 'Mortality', $3, $4, $5, $6)`,
    [
      genId(), session.user.id, record.id,
      JSON.stringify({ quantity: existing.quantity, date: existing.date, reason: existing.reason }),
      JSON.stringify(parsed.data),
      `${session.user.name} editou um registro de mortalidade.`,
    ]
  );

  return NextResponse.json({ record });
}
