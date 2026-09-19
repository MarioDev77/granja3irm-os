import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, genId, withTransaction } from '@/lib/db';
import { SECTIONS, ROLES } from '@/lib/rbac';
import { requireSection, badRequest } from '@/lib/apiAuth';

const movementSchema = z.object({
  feedId: z.string().min(1, 'Selecione a ração.'),
  type: z.enum(['IN', 'OUT']),
  quantity: z.coerce.number().positive('Informe uma quantidade válida.'),
  unitValue: z.coerce.number().min(0).optional().nullable(),
  document: z.string().optional().nullable(),
  shedId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  date: z.string().min(1, 'Informe a data.'),
  // Só é aceito quando o próprio Administrador confirma a saída mesmo sem
  // estoque suficiente (ver seção 12 do escopo: nunca permitir estoque
  // negativo sem autorização administrativa).
  authorizeNegative: z.boolean().optional(),
});

export async function GET(request) {
  const { error } = await requireSection(SECTIONS.STOCK);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const take = Math.min(Number(searchParams.get('take')) || 50, 200);

  const { rows: movements } = await query(
    `SELECT
       fm.id, fm.feed_id AS "feedId", fm.type, fm.quantity, fm.unit_value AS "unitValue",
       fm.document, fm.shed_id AS "shedId", fm.notes, fm.date, fm.responsible_id AS "responsibleId",
       json_build_object('name', f.name, 'unit', f.unit) AS feed,
       json_build_object('name', u.name) AS responsible
     FROM feed_movements fm
     JOIN feeds f ON f.id = fm.feed_id
     JOIN users u ON u.id = fm.responsible_id
     ORDER BY fm.date DESC
     LIMIT $1`,
    [take]
  );

  return NextResponse.json({ movements });
}

export async function POST(request) {
  const { session, error } = await requireSection(SECTIONS.STOCK);
  if (error) return error;

  const parsed = movementSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error.errors[0].message);

  const { feedId, type, quantity, unitValue, document, shedId, notes, date, authorizeNegative } = parsed.data;

  const { rows: feedRows } = await query('SELECT * FROM feeds WHERE id = $1', [feedId]);
  const feed = feedRows[0];
  if (!feed) return badRequest('Ração inválida.');

  const delta = type === 'IN' ? Number(quantity) : -Number(quantity);
  const resultingStock = Number(feed.current_stock) + delta;

  if (resultingStock < 0 && !(authorizeNegative && session.user.role === ROLES.ADMIN)) {
    return badRequest(
      'Estoque insuficiente para esta saída. Apenas um administrador pode autorizar estoque negativo.'
    );
  }

  const { movement, updatedFeed } = await withTransaction(async (client) => {
    const { rows: movementRows } = await client.query(
      `INSERT INTO feed_movements (id, feed_id, type, quantity, unit_value, document, shed_id, responsible_id, notes, date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, feed_id AS "feedId", type, quantity, unit_value AS "unitValue", document,
         shed_id AS "shedId", notes, date, responsible_id AS "responsibleId"`,
      [genId(), feedId, type, quantity, unitValue ?? null, document || null, shedId || null, session.user.id, notes || null, new Date(date)]
    );
    const { rows: feedUpdateRows } = await client.query(
      `UPDATE feeds SET current_stock = $1, updated_at = now() WHERE id = $2
       RETURNING id, name, unit, current_stock AS "currentStock", minimum_stock AS "minimumStock"`,
      [resultingStock, feedId]
    );

    await client.query(
      `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, new_data, description)
       VALUES ($1, $2, 'CREATE', 'FeedMovement', $3, $4, $5)`,
      [
        genId(), session.user.id, movementRows[0].id, JSON.stringify({ feedId, type, quantity }),
        `${session.user.name} registrou ${type === 'IN' ? 'entrada' : 'saída'} de ${quantity}${feed.unit} de ${feed.name}.`,
      ]
    );

    return { movement: movementRows[0], updatedFeed: feedUpdateRows[0] };
  });

  let stockAlertTriggered = false;
  if (Number(updatedFeed.currentStock) <= Number(updatedFeed.minimumStock)) {
    stockAlertTriggered = true;
    await query(
      `INSERT INTO notifications (id, severity, title, message, category)
       VALUES ($1, 'CRITICAL', 'Estoque crítico', $2, 'FEED_STOCK')`,
      [
        genId(),
        `${updatedFeed.name}: estoque atual de ${updatedFeed.currentStock}${updatedFeed.unit}, abaixo ou no limite mínimo (${updatedFeed.minimumStock}${updatedFeed.unit}).`,
      ]
    );
  }

  return NextResponse.json({ movement, feed: updatedFeed, stockAlertTriggered }, { status: 201 });
}
