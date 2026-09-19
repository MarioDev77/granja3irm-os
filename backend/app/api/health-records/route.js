import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, genId } from '@/lib/db';
import { SECTIONS } from '@/lib/rbac';
import { requireSection, badRequest } from '@/lib/apiAuth';

const healthRecordSchema = z.object({
  issue: z.string().min(1, 'Informe a doença/problema observado.'),
  flockId: z.string().min(1, 'Selecione o lote.'),
  affectedQuantity: z.coerce.number().int().min(0).optional().nullable(),
  symptoms: z.string().optional().nullable(),
  treatment: z.string().optional().nullable(),
  date: z.string().min(1, 'Informe a data.'),
  notes: z.string().optional().nullable(),
});

export async function GET() {
  const { error } = await requireSection(SECTIONS.HEALTH);
  if (error) return error;

  const { rows: records } = await query(
    `SELECT
       h.id, h.issue, h.flock_id AS "flockId", h.affected_quantity AS "affectedQuantity",
       h.symptoms, h.treatment, h.date, h.notes,
       json_build_object('name', f.name, 'code', f.code) AS flock
     FROM health_records h
     JOIN flocks f ON f.id = h.flock_id
     ORDER BY h.date DESC`
  );

  return NextResponse.json({ records });
}

export async function POST(request) {
  const { session, error } = await requireSection(SECTIONS.HEALTH);
  if (error) return error;

  const parsed = healthRecordSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error.errors[0].message);

  const { issue, flockId, affectedQuantity, symptoms, treatment, date, notes } = parsed.data;

  const { rows: flockRows } = await query('SELECT * FROM flocks WHERE id = $1', [flockId]);
  const flock = flockRows[0];
  if (!flock) return badRequest('Lote inválido.');

  const { rows } = await query(
    `INSERT INTO health_records (id, issue, flock_id, affected_quantity, symptoms, treatment, date, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, issue, flock_id AS "flockId", affected_quantity AS "affectedQuantity", symptoms, treatment, date, notes`,
    [genId(), issue, flockId, affectedQuantity ?? null, symptoms || null, treatment || null, new Date(date), notes || null]
  );
  const record = rows[0];

  await query(
    `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, new_data, description)
     VALUES ($1, $2, 'CREATE', 'HealthRecord', $3, $4, $5)`,
    [
      genId(), session.user.id, record.id,
      JSON.stringify({ issue, flockId, affectedQuantity, symptoms, treatment, date, notes }),
      `${session.user.name} registrou ocorrência sanitária (${issue}) no lote ${flock.name}.`,
    ]
  );

  return NextResponse.json({ record }, { status: 201 });
}
