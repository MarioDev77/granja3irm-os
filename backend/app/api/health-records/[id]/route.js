import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, genId } from '@/lib/db';
import { SECTIONS } from '@/lib/rbac';
import { requireSection, badRequest, notFound } from '@/lib/apiAuth';

const updateSchema = z.object({
  issue: z.string().min(1).optional(),
  flockId: z.string().min(1).optional(),
  affectedQuantity: z.coerce.number().int().min(0).optional().nullable(),
  symptoms: z.string().optional().nullable(),
  treatment: z.string().optional().nullable(),
  date: z.string().min(1).optional(),
  notes: z.string().optional().nullable(),
});

const SELECT = `id, issue, flock_id AS "flockId", affected_quantity AS "affectedQuantity", symptoms, treatment, date, notes`;

export async function PATCH(request, { params: __p }) {
  const params = await __p;
  const { session, error } = await requireSection(SECTIONS.HEALTH);
  if (error) return error;

  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error.errors[0].message);

  const { rows: existingRows } = await query('SELECT * FROM health_records WHERE id = $1', [params.id]);
  const existing = existingRows[0];
  if (!existing) return notFound('Ocorrência sanitária não encontrada.');

  const { issue, flockId, affectedQuantity, symptoms, treatment, date, notes } = parsed.data;

  if (flockId) {
    const { rows: flockRows } = await query('SELECT id FROM flocks WHERE id = $1', [flockId]);
    if (!flockRows[0]) return badRequest('Lote inválido.');
  }

  const { rows } = await query(
    `UPDATE health_records SET
       issue = $1, flock_id = $2, affected_quantity = $3, symptoms = $4, treatment = $5, date = $6, notes = $7
     WHERE id = $8
     RETURNING ${SELECT}`,
    [
      issue ?? existing.issue,
      flockId ?? existing.flock_id,
      affectedQuantity !== undefined ? affectedQuantity : existing.affected_quantity,
      symptoms !== undefined ? symptoms : existing.symptoms,
      treatment !== undefined ? treatment : existing.treatment,
      date ? new Date(date) : existing.date,
      notes !== undefined ? notes : existing.notes,
      params.id,
    ]
  );
  const record = rows[0];

  await query(
    `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, previous_data, new_data, description)
     VALUES ($1, $2, 'UPDATE', 'HealthRecord', $3, $4, $5, $6)`,
    [
      genId(), session.user.id, record.id,
      JSON.stringify({ issue: existing.issue, date: existing.date }),
      JSON.stringify(parsed.data),
      `${session.user.name} editou uma ocorrência sanitária.`,
    ]
  );

  return NextResponse.json({ record });
}
