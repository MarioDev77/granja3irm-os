import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, genId } from '@/lib/db';
import { SECTIONS } from '@/lib/rbac';
import { requireSection, badRequest } from '@/lib/apiAuth';

const vaccinationSchema = z.object({
  vaccine: z.string().min(1, 'Informe o nome da vacina.'),
  flockId: z.string().min(1, 'Selecione o lote.'),
  date: z.string().min(1, 'Informe a data.'),
  quantity: z.coerce.number().int().positive('Informe a quantidade aplicada.'),
  nextDoseDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET() {
  const { error } = await requireSection(SECTIONS.HEALTH);
  if (error) return error;

  const { rows: vaccinations } = await query(
    `SELECT
       v.id, v.vaccine, v.flock_id AS "flockId", v.date, v.quantity,
       v.next_dose_date AS "nextDoseDate", v.notes,
       json_build_object('name', f.name, 'code', f.code) AS flock
     FROM vaccinations v
     JOIN flocks f ON f.id = v.flock_id
     ORDER BY v.date DESC`
  );

  return NextResponse.json({ vaccinations });
}

export async function POST(request) {
  const { session, error } = await requireSection(SECTIONS.HEALTH);
  if (error) return error;

  const parsed = vaccinationSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error.errors[0].message);

  const { vaccine, flockId, date, quantity, nextDoseDate, notes } = parsed.data;

  const { rows: flockRows } = await query('SELECT * FROM flocks WHERE id = $1', [flockId]);
  const flock = flockRows[0];
  if (!flock) return badRequest('Lote inválido.');

  const { rows } = await query(
    `INSERT INTO vaccinations (id, vaccine, flock_id, date, quantity, next_dose_date, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, vaccine, flock_id AS "flockId", date, quantity, next_dose_date AS "nextDoseDate", notes`,
    [genId(), vaccine, flockId, new Date(date), quantity, nextDoseDate ? new Date(nextDoseDate) : null, notes || null]
  );
  const vaccination = rows[0];

  await query(
    `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, new_data, description)
     VALUES ($1, $2, 'CREATE', 'Vaccination', $3, $4, $5)`,
    [
      genId(), session.user.id, vaccination.id,
      JSON.stringify({ vaccine, flockId, date, quantity, nextDoseDate, notes }),
      `${session.user.name} registrou aplicação de ${vaccine} no lote ${flock.name}.`,
    ]
  );

  return NextResponse.json({ vaccination }, { status: 201 });
}
