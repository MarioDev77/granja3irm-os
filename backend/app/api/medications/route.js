import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, genId } from '@/lib/db';
import { SECTIONS } from '@/lib/rbac';
import { requireSection, badRequest } from '@/lib/apiAuth';

const medicationSchema = z.object({
  name: z.string().min(1, 'Informe o nome do medicamento.'),
  flockId: z.string().min(1, 'Selecione o lote.'),
  quantity: z.coerce.number().positive('Informe a quantidade.'),
  dosage: z.string().optional().nullable(),
  reason: z.string().optional().nullable(),
  date: z.string().min(1, 'Informe a data.'),
  notes: z.string().optional().nullable(),
});

export async function GET() {
  const { error } = await requireSection(SECTIONS.HEALTH);
  if (error) return error;

  const { rows: medications } = await query(
    `SELECT
       m.id, m.name, m.flock_id AS "flockId", m.quantity, m.dosage, m.reason, m.date, m.notes,
       json_build_object('name', f.name, 'code', f.code) AS flock
     FROM medications m
     JOIN flocks f ON f.id = m.flock_id
     ORDER BY m.date DESC`
  );

  return NextResponse.json({ medications });
}

export async function POST(request) {
  const { session, error } = await requireSection(SECTIONS.HEALTH);
  if (error) return error;

  const parsed = medicationSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error.errors[0].message);

  const { name, flockId, quantity, dosage, reason, date, notes } = parsed.data;

  const { rows: flockRows } = await query('SELECT * FROM flocks WHERE id = $1', [flockId]);
  const flock = flockRows[0];
  if (!flock) return badRequest('Lote inválido.');

  const { rows } = await query(
    `INSERT INTO medications (id, name, flock_id, quantity, dosage, reason, date, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, name, flock_id AS "flockId", quantity, dosage, reason, date, notes`,
    [genId(), name, flockId, quantity, dosage || null, reason || null, new Date(date), notes || null]
  );
  const medication = rows[0];

  await query(
    `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, new_data, description)
     VALUES ($1, $2, 'CREATE', 'Medication', $3, $4, $5)`,
    [
      genId(), session.user.id, medication.id,
      JSON.stringify({ name, flockId, quantity, dosage, reason, date, notes }),
      `${session.user.name} registrou aplicação de ${name} no lote ${flock.name}.`,
    ]
  );

  return NextResponse.json({ medication }, { status: 201 });
}
