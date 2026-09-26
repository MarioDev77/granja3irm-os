import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, genId } from '@/lib/db';
import { SECTIONS } from '@/lib/rbac';
import { requireSection, badRequest, notFound } from '@/lib/apiAuth';

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  flockId: z.string().min(1).optional(),
  quantity: z.coerce.number().positive().optional(),
  dosage: z.string().optional().nullable(),
  reason: z.string().optional().nullable(),
  date: z.string().min(1).optional(),
  notes: z.string().optional().nullable(),
});

const SELECT = `id, name, flock_id AS "flockId", quantity, dosage, reason, date, notes`;

export async function PATCH(request, { params: __p }) {
  const params = await __p;
  const { session, error } = await requireSection(SECTIONS.HEALTH);
  if (error) return error;

  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error.errors[0].message);

  const { rows: existingRows } = await query('SELECT * FROM medications WHERE id = $1', [params.id]);
  const existing = existingRows[0];
  if (!existing) return notFound('Registro de medicação não encontrado.');

  const { name, flockId, quantity, dosage, reason, date, notes } = parsed.data;

  if (flockId) {
    const { rows: flockRows } = await query('SELECT id FROM flocks WHERE id = $1', [flockId]);
    if (!flockRows[0]) return badRequest('Lote inválido.');
  }

  const { rows } = await query(
    `UPDATE medications SET
       name = $1, flock_id = $2, quantity = $3, dosage = $4, reason = $5, date = $6, notes = $7
     WHERE id = $8
     RETURNING ${SELECT}`,
    [
      name ?? existing.name,
      flockId ?? existing.flock_id,
      quantity ?? existing.quantity,
      dosage !== undefined ? dosage : existing.dosage,
      reason !== undefined ? reason : existing.reason,
      date ? new Date(date) : existing.date,
      notes !== undefined ? notes : existing.notes,
      params.id,
    ]
  );
  const medication = rows[0];

  await query(
    `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, previous_data, new_data, description)
     VALUES ($1, $2, 'UPDATE', 'Medication', $3, $4, $5, $6)`,
    [
      genId(), session.user.id, medication.id,
      JSON.stringify({ name: existing.name, quantity: existing.quantity, date: existing.date }),
      JSON.stringify(parsed.data),
      `${session.user.name} editou um registro de medicação.`,
    ]
  );

  return NextResponse.json({ medication });
}
