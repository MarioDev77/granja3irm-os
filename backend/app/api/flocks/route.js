import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, genId } from '@/lib/db';
import { SECTIONS } from '@/lib/rbac';
import { requireSection, badRequest } from '@/lib/apiAuth';

const flockSchema = z.object({
  code: z.string().min(1, 'Informe o código do lote.'),
  name: z.string().min(1, 'Informe o nome do lote.'),
  shedId: z.string().min(1, 'Selecione o galpão.'),
  entryDate: z.string().min(1, 'Informe a data de entrada.'),
  birthDate: z.string().optional().nullable(),
  breed: z.string().optional().nullable(),
  initialQuantity: z.coerce.number().int().positive('Quantidade inicial deve ser maior que zero.'),
  origin: z.string().optional().nullable(),
  productionType: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

function ageInDays(entryDate) {
  return Math.max(0, Math.floor((Date.now() - new Date(entryDate).getTime()) / 86_400_000));
}

export async function GET() {
  const { error } = await requireSection(SECTIONS.PRODUCTION);
  if (error) return error;

  const { rows: flocks } = await query(
    `SELECT
       f.id, f.code, f.name, f.entry_date AS "entryDate", f.breed, f.status, f.initial_quantity AS "initialQuantity",
       f.shed_id AS "shedId",
       json_build_object('id', s.id, 'name', s.name, 'code', s.code) AS shed,
       COALESCE((SELECT COUNT(*)::int FROM birds b WHERE b.flock_id = f.id AND b.status = 'ACTIVE'), 0) AS "activeBirds",
       COALESCE((SELECT SUM(ep.good_eggs)::int FROM egg_productions ep WHERE ep.flock_id = f.id), 0) AS "totalEggs",
       COALESCE((SELECT SUM(m.quantity)::int FROM mortality_records m WHERE m.flock_id = f.id), 0) AS "mortalityTotal"
     FROM flocks f
     JOIN sheds s ON s.id = f.shed_id
     ORDER BY f.entry_date DESC`
  );

  const result = flocks.map((flock) => {
    const mortalityRate =
      flock.initialQuantity > 0 ? Math.round((flock.mortalityTotal / flock.initialQuantity) * 1000) / 10 : 0;
    return { ...flock, ageDays: ageInDays(flock.entryDate), mortalityRate };
  });

  return NextResponse.json({ flocks: result });
}

export async function POST(request) {
  const { session, error } = await requireSection(SECTIONS.PRODUCTION);
  if (error) return error;

  const parsed = flockSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error.errors[0].message);

  const { rows: existingCodeRows } = await query('SELECT id FROM flocks WHERE code = $1', [parsed.data.code]);
  if (existingCodeRows.length > 0) return badRequest('Já existe um lote com este código.');

  const { rows: shedRows } = await query('SELECT * FROM sheds WHERE id = $1', [parsed.data.shedId]);
  const shed = shedRows[0];
  if (!shed || shed.deleted_at) return badRequest('Galpão inválido.');

  const {
    code, name, shedId, entryDate, birthDate, breed, initialQuantity, origin, productionType, notes,
  } = parsed.data;

  const { rows } = await query(
    `INSERT INTO flocks (id, code, name, shed_id, entry_date, birth_date, breed, initial_quantity, origin, production_type, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id, code, name, shed_id AS "shedId", entry_date AS "entryDate", birth_date AS "birthDate",
       breed, initial_quantity AS "initialQuantity", origin, production_type AS "productionType", status, notes`,
    [
      genId(), code, name, shedId, new Date(entryDate), birthDate ? new Date(birthDate) : null,
      breed || null, initialQuantity, origin || null, productionType || null, notes || null,
    ]
  );
  const flock = rows[0];

  await query(
    `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, new_data, description)
     VALUES ($1, $2, 'CREATE', 'Flock', $3, $4, $5)`,
    [
      genId(), session.user.id, flock.id, JSON.stringify(parsed.data),
      `${session.user.name} cadastrou o lote ${flock.name} (${flock.code}).`,
    ]
  );

  return NextResponse.json({ flock }, { status: 201 });
}
