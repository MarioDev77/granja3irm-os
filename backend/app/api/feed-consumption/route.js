import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, genId, withTransaction } from '@/lib/db';
import { SECTIONS, ROLES } from '@/lib/rbac';
import { requireSection, badRequest } from '@/lib/apiAuth';

const consumptionSchema = z.object({
  date: z.string().min(1, 'Informe a data.'),
  flockId: z.string().min(1, 'Selecione o lote.'),
  feedId: z.string().min(1, 'Selecione a ração.'),
  quantity: z.coerce.number().positive('Informe uma quantidade válida.'),
  notes: z.string().optional().nullable(),
  authorizeNegative: z.boolean().optional(),
});

export async function GET(request) {
  const { error } = await requireSection(SECTIONS.STOCK);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const take = Math.min(Number(searchParams.get('take')) || 50, 200);

  const { rows: consumptions } = await query(
    `SELECT
       fc.id, fc.date, fc.flock_id AS "flockId", fc.feed_id AS "feedId", fc.quantity, fc.notes,
       json_build_object('name', f.name, 'code', f.code) AS flock,
       json_build_object('name', fe.name, 'unit', fe.unit, 'averagePrice', fe.average_price) AS feed
     FROM feed_consumptions fc
     JOIN flocks f ON f.id = fc.flock_id
     JOIN feeds fe ON fe.id = fc.feed_id
     ORDER BY fc.date DESC
     LIMIT $1`,
    [take]
  );

  const withCost = await Promise.all(
    consumptions.map(async (c) => {
      const { rows: countRows } = await query(
        `SELECT COUNT(*)::int AS count FROM birds WHERE flock_id = $1 AND status = 'ACTIVE'`,
        [c.flockId]
      );
      const activeBirds = countRows[0].count;
      const cost = c.feed.averagePrice ? Number(c.feed.averagePrice) * Number(c.quantity) : null;
      const costPerBird = cost && activeBirds > 0 ? Math.round((cost / activeBirds) * 100) / 100 : null;
      return { ...c, cost, costPerBird, activeBirds };
    })
  );

  return NextResponse.json({ consumptions: withCost });
}

export async function POST(request) {
  const { session, error } = await requireSection(SECTIONS.STOCK);
  if (error) return error;

  const parsed = consumptionSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error.errors[0].message);

  const { date, flockId, feedId, quantity, notes, authorizeNegative } = parsed.data;

  const [flockResult, feedResult] = await Promise.all([
    query('SELECT * FROM flocks WHERE id = $1', [flockId]),
    query('SELECT * FROM feeds WHERE id = $1', [feedId]),
  ]);
  const flock = flockResult.rows[0];
  const feed = feedResult.rows[0];
  if (!flock) return badRequest('Lote inválido.');
  if (!feed) return badRequest('Ração inválida.');

  const resultingStock = Number(feed.current_stock) - Number(quantity);
  if (resultingStock < 0 && !(authorizeNegative && session.user.role === ROLES.ADMIN)) {
    return badRequest(
      'Estoque insuficiente para este consumo. Apenas um administrador pode autorizar estoque negativo.'
    );
  }

  const { consumption, updatedFeed } = await withTransaction(async (client) => {
    const { rows: consumptionRows } = await client.query(
      `INSERT INTO feed_consumptions (id, date, flock_id, feed_id, quantity, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, date, flock_id AS "flockId", feed_id AS "feedId", quantity, notes`,
      [genId(), new Date(date), flockId, feedId, quantity, notes || null]
    );
    const { rows: feedRows } = await client.query(
      `UPDATE feeds SET current_stock = $1, updated_at = now() WHERE id = $2
       RETURNING id, name, unit, current_stock AS "currentStock", minimum_stock AS "minimumStock"`,
      [resultingStock, feedId]
    );

    await client.query(
      `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, new_data, description)
       VALUES ($1, $2, 'CREATE', 'FeedConsumption', $3, $4, $5)`,
      [
        genId(), session.user.id, consumptionRows[0].id, JSON.stringify({ flockId, feedId, quantity }),
        `${session.user.name} registrou consumo de ${quantity}${feed.unit} de ${feed.name} no lote ${flock.name}.`,
      ]
    );

    return { consumption: consumptionRows[0], updatedFeed: feedRows[0] };
  });

  let stockAlertTriggered = false;
  if (Number(updatedFeed.currentStock) <= Number(updatedFeed.minimumStock)) {
    stockAlertTriggered = true;
    await query(
      `INSERT INTO notifications (id, severity, title, message, category)
       VALUES ($1, 'CRITICAL', 'Estoque crítico', $2, 'FEED_STOCK')`,
      [genId(), `${updatedFeed.name}: estoque atual de ${updatedFeed.currentStock}${updatedFeed.unit}, abaixo ou no limite mínimo.`]
    );
  }

  return NextResponse.json({ consumption, feed: updatedFeed, stockAlertTriggered }, { status: 201 });
}
