import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, genId } from '@/lib/db';
import { SECTIONS } from '@/lib/rbac';
import { requireSection, badRequest } from '@/lib/apiAuth';

const costSchema = z.object({
  referenceMonth: z.string().min(1, 'Informe o mês de referência.'),
  medicationCost: z.coerce.number().min(0).default(0),
  laborCost: z.coerce.number().min(0).default(0),
  energyCost: z.coerce.number().min(0).default(0),
  waterCost: z.coerce.number().min(0).default(0),
  otherCost: z.coerce.number().min(0).default(0),
});

function monthBounds(dateStr) {
  const [year, month] = dateStr.split('-').map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59);
  return { start, end };
}

export async function GET() {
  const { error } = await requireSection(SECTIONS.FINANCE);
  if (error) return error;

  const { rows: costs } = await query(
    `SELECT id, reference_month AS "referenceMonth", feed_cost AS "feedCost", medication_cost AS "medicationCost",
       labor_cost AS "laborCost", energy_cost AS "energyCost", water_cost AS "waterCost", other_cost AS "otherCost"
     FROM production_costs ORDER BY reference_month DESC`
  );

  const withCalculations = await Promise.all(
    costs.map(async (c) => {
      const start = new Date(c.referenceMonth);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59);

      const [eggSumResult, birdCountResult] = await Promise.all([
        query(`SELECT COALESCE(SUM(good_eggs), 0)::int AS total FROM egg_productions WHERE date >= $1 AND date <= $2`, [start, end]),
        query(`SELECT COUNT(*)::int AS count FROM birds WHERE status = 'ACTIVE'`),
      ]);

      const totalEggs = eggSumResult.rows[0].total || 0;
      const birdCount = birdCountResult.rows[0].count;
      const totalCost =
        Number(c.feedCost) + Number(c.medicationCost) + Number(c.laborCost) +
        Number(c.energyCost) + Number(c.waterCost) + Number(c.otherCost);

      return {
        ...c,
        totalCost,
        totalEggs,
        costPerEgg: totalEggs > 0 ? Math.round((totalCost / totalEggs) * 10000) / 10000 : null,
        costPerBird: birdCount > 0 ? Math.round((totalCost / birdCount) * 100) / 100 : null,
      };
    })
  );

  return NextResponse.json({ costs: withCalculations });
}

export async function POST(request) {
  const { session, error } = await requireSection(SECTIONS.FINANCE);
  if (error) return error;

  const parsed = costSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error.errors[0].message);

  const { referenceMonth, medicationCost, laborCost, energyCost, waterCost, otherCost } = parsed.data;
  const { start, end } = monthBounds(referenceMonth);

  const { rows: existingRows } = await query('SELECT id FROM production_costs WHERE reference_month = $1', [start]);
  if (existingRows.length > 0) {
    return badRequest('Já existe um lançamento de custo para este mês. Edite o existente.');
  }

  // Custo de ração é calculado automaticamente a partir do consumo real do
  // mês (seção 21 do escopo), não digitado manualmente.
  const { rows: consumptions } = await query(
    `SELECT fc.quantity, f.average_price AS "averagePrice"
     FROM feed_consumptions fc JOIN feeds f ON f.id = fc.feed_id
     WHERE fc.date >= $1 AND fc.date <= $2`,
    [start, end]
  );
  const feedCost = consumptions.reduce((sum, c) => sum + Number(c.quantity) * Number(c.averagePrice || 0), 0);

  const { rows } = await query(
    `INSERT INTO production_costs (id, reference_month, feed_cost, medication_cost, labor_cost, energy_cost, water_cost, other_cost)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, reference_month AS "referenceMonth", feed_cost AS "feedCost", medication_cost AS "medicationCost",
       labor_cost AS "laborCost", energy_cost AS "energyCost", water_cost AS "waterCost", other_cost AS "otherCost"`,
    [genId(), start, feedCost, medicationCost, laborCost, energyCost, waterCost, otherCost]
  );
  const cost = rows[0];

  await query(
    `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, new_data, description)
     VALUES ($1, $2, 'CREATE', 'ProductionCost', $3, $4, $5)`,
    [
      genId(), session.user.id, cost.id,
      JSON.stringify({ referenceMonth, feedCost, medicationCost, laborCost, energyCost, waterCost, otherCost }),
      `${session.user.name} lançou o custo de produção de ${referenceMonth}.`,
    ]
  );

  return NextResponse.json({ cost }, { status: 201 });
}
