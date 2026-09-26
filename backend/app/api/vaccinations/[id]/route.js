import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, genId } from '@/lib/db';
import { SECTIONS } from '@/lib/rbac';
import { requireSection, badRequest, notFound } from '@/lib/apiAuth';

const updateSchema = z.object({
  vaccine: z.string().min(1).optional(),
  flockId: z.string().min(1).optional(),
  date: z.string().min(1).optional(),
  quantity: z.coerce.number().int().positive().optional(),
  nextDoseDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const SELECT = `id, vaccine, flock_id AS "flockId", date, quantity, next_dose_date AS "nextDoseDate", notes`;

export async function PATCH(request, { params: __p }) {
  const params = await __p;
  const { session, error } = await requireSection(SECTIONS.HEALTH);
  if (error) return error;

  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error.errors[0].message);

  const { rows: existingRows } = await query('SELECT * FROM vaccinations WHERE id = $1', [params.id]);
  const existing = existingRows[0];
  if (!existing) return notFound('Registro de vacinação não encontrado.');

  const { vaccine, flockId, date, quantity, nextDoseDate, notes } = parsed.data;

  if (flockId) {
    const { rows: flockRows } = await query('SELECT id FROM flocks WHERE id = $1', [flockId]);
    if (!flockRows[0]) return badRequest('Lote inválido.');
  }

  const { rows } = await query(
    `UPDATE vaccinations SET
       vaccine = $1, flock_id = $2, date = $3, quantity = $4, next_dose_date = $5, notes = $6
     WHERE id = $7
     RETURNING ${SELECT}`,
    [
      vaccine ?? existing.vaccine,
      flockId ?? existing.flock_id,
      date ? new Date(date) : existing.date,
      quantity ?? existing.quantity,
      nextDoseDate !== undefined ? (nextDoseDate ? new Date(nextDoseDate) : null) : existing.next_dose_date,
      notes !== undefined ? notes : existing.notes,
      params.id,
    ]
  );
  const vaccination = rows[0];

  await query(
    `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, previous_data, new_data, description)
     VALUES ($1, $2, 'UPDATE', 'Vaccination', $3, $4, $5, $6)`,
    [
      genId(), session.user.id, vaccination.id,
      JSON.stringify({ vaccine: existing.vaccine, quantity: existing.quantity, date: existing.date }),
      JSON.stringify(parsed.data),
      `${session.user.name} editou um registro de vacinação.`,
    ]
  );

  return NextResponse.json({ vaccination });
}
