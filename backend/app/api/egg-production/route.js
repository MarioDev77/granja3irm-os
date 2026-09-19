import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, genId } from '@/lib/db';
import { SECTIONS } from '@/lib/rbac';
import { requireSection, badRequest } from '@/lib/apiAuth';

const productionSchema = z.object({
  date: z.string().min(1, 'Informe a data.'),
  flockId: z.string().min(1, 'Selecione o lote.'),
  goodEggs: z.coerce.number().int().min(0),
  brokenEggs: z.coerce.number().int().min(0).default(0),
  dirtyEggs: z.coerce.number().int().min(0).default(0),
  discardedEggs: z.coerce.number().int().min(0).default(0),
  notes: z.string().optional().nullable(),
});

export async function GET(request) {
  const { error } = await requireSection(SECTIONS.PRODUCTION);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const take = Math.min(Number(searchParams.get('take')) || 50, 200);

  const { rows: records } = await query(
    `SELECT
       ep.id, ep.date, ep.flock_id AS "flockId", ep.good_eggs AS "goodEggs", ep.broken_eggs AS "brokenEggs",
       ep.dirty_eggs AS "dirtyEggs", ep.discarded_eggs AS "discardedEggs", ep.notes, ep.responsible_id AS "responsibleId",
       json_build_object('code', f.code, 'name', f.name) AS flock,
       json_build_object('name', u.name) AS responsible,
       COALESCE((SELECT COUNT(*)::int FROM birds b WHERE b.flock_id = ep.flock_id AND b.status = 'ACTIVE'), 0) AS "activeBirds"
     FROM egg_productions ep
     JOIN flocks f ON f.id = ep.flock_id
     JOIN users u ON u.id = ep.responsible_id
     ORDER BY ep.date DESC
     LIMIT $1`,
    [take]
  );

  const withCalculations = records.map((record) => {
    const quantity = record.goodEggs + record.brokenEggs + record.dirtyEggs + record.discardedEggs;
    const layingRate =
      record.activeBirds > 0 ? Math.round((record.goodEggs / record.activeBirds) * 1000) / 10 : null;
    const lossPercent =
      quantity > 0
        ? Math.round(((record.brokenEggs + record.dirtyEggs + record.discardedEggs) / quantity) * 1000) / 10
        : 0;

    return { ...record, quantity, layingRate, lossPercent };
  });

  return NextResponse.json({ records: withCalculations });
}

export async function POST(request) {
  const { session, error } = await requireSection(SECTIONS.PRODUCTION);
  if (error) return error;

  const parsed = productionSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error.errors[0].message);

  const { rows: flockRows } = await query('SELECT * FROM flocks WHERE id = $1', [parsed.data.flockId]);
  const flock = flockRows[0];
  if (!flock) return badRequest('Lote inválido.');

  const { date, flockId, goodEggs, brokenEggs, dirtyEggs, discardedEggs, notes } = parsed.data;
  const quantity = goodEggs + brokenEggs + dirtyEggs + discardedEggs;

  const { rows } = await query(
    `INSERT INTO egg_productions (id, date, flock_id, quantity, good_eggs, broken_eggs, dirty_eggs, discarded_eggs, notes, responsible_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id, date, flock_id AS "flockId", quantity, good_eggs AS "goodEggs", broken_eggs AS "brokenEggs",
       dirty_eggs AS "dirtyEggs", discarded_eggs AS "discardedEggs", notes, responsible_id AS "responsibleId"`,
    [genId(), new Date(date), flockId, quantity, goodEggs, brokenEggs, dirtyEggs, discardedEggs, notes || null, session.user.id]
  );
  const record = rows[0];

  await query(
    `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, new_data, description)
     VALUES ($1, $2, 'CREATE', 'EggProduction', $3, $4, $5)`,
    [
      genId(), session.user.id, record.id, JSON.stringify(parsed.data),
      `${session.user.name} registrou produção de ${goodEggs} ovos no lote ${flock.name}.`,
    ]
  );

  return NextResponse.json({ record }, { status: 201 });
}
