import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, genId, withTransaction } from '@/lib/db';
import { SECTIONS, ROLES } from '@/lib/rbac';
import { requireSection, badRequest, notFound } from '@/lib/apiAuth';

const updateSchema = z.object({
  date: z.string().min(1).optional(),
  flockId: z.string().min(1).optional(),
  feedId: z.string().min(1).optional(),
  quantity: z.coerce.number().positive().optional(),
  notes: z.string().optional().nullable(),
  authorizeNegative: z.boolean().optional(),
});

// Edição de um consumo já lançado precisa reverter o efeito no estoque da
// ração original antes de aplicar o novo valor (seção 4 do escopo: "se uma
// alteração influencia... o estoque, deve ser recalculado corretamente").
export async function PATCH(request, { params: __p }) {
  const params = await __p;
  const { session, error } = await requireSection(SECTIONS.STOCK);
  if (error) return error;

  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error.errors[0].message);

  const { rows: existingRows } = await query('SELECT * FROM feed_consumptions WHERE id = $1', [params.id]);
  const existing = existingRows[0];
  if (!existing) return notFound('Consumo de ração não encontrado.');

  const { date, flockId, feedId, quantity, notes, authorizeNegative } = parsed.data;
  const targetFlockId = flockId ?? existing.flock_id;
  const targetFeedId = feedId ?? existing.feed_id;
  const targetQuantity = quantity ?? Number(existing.quantity);

  const [flockResult, feedResult] = await Promise.all([
    query('SELECT * FROM flocks WHERE id = $1', [targetFlockId]),
    query('SELECT * FROM feeds WHERE id = $1', [targetFeedId]),
  ]);
  if (!flockResult.rows[0]) return badRequest('Lote inválido.');
  const feed = feedResult.rows[0];
  if (!feed) return badRequest('Ração inválida.');

  // Estoque atual "devolvendo" o consumo antigo (se for a mesma ração) e
  // aplicando o novo valor.
  let baseStock = Number(feed.current_stock);
  if (existing.feed_id === targetFeedId) {
    baseStock += Number(existing.quantity); // desfaz o consumo anterior
  }
  const resultingStock = baseStock - targetQuantity;

  if (resultingStock < 0 && !(authorizeNegative && session.user.role === ROLES.ADMIN)) {
    return badRequest(
      'Estoque insuficiente para este consumo. Apenas um administrador pode autorizar estoque negativo.'
    );
  }

  const { consumption, updatedFeed } = await withTransaction(async (client) => {
    // Se a ração mudou, devolve a quantidade antiga à ração original.
    if (existing.feed_id !== targetFeedId) {
      await client.query('UPDATE feeds SET current_stock = current_stock + $1, updated_at = now() WHERE id = $2', [
        Number(existing.quantity),
        existing.feed_id,
      ]);
    }

    const { rows: consumptionRows } = await client.query(
      `UPDATE feed_consumptions SET date = $1, flock_id = $2, feed_id = $3, quantity = $4, notes = $5, updated_at = now()
       WHERE id = $6
       RETURNING id, date, flock_id AS "flockId", feed_id AS "feedId", quantity, notes`,
      [
        date ? new Date(date) : existing.date,
        targetFlockId,
        targetFeedId,
        targetQuantity,
        notes !== undefined ? notes : existing.notes,
        params.id,
      ]
    );

    const { rows: feedRows } = await client.query(
      `UPDATE feeds SET current_stock = $1, updated_at = now() WHERE id = $2
       RETURNING id, name, unit, current_stock AS "currentStock", minimum_stock AS "minimumStock"`,
      [resultingStock, targetFeedId]
    );

    await client.query(
      `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, previous_data, new_data, description)
       VALUES ($1, $2, 'UPDATE', 'FeedConsumption', $3, $4, $5, $6)`,
      [
        genId(), session.user.id, consumptionRows[0].id,
        JSON.stringify({ quantity: existing.quantity, feedId: existing.feed_id }),
        JSON.stringify(parsed.data),
        `${session.user.name} editou um lançamento de consumo de ração.`,
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

  return NextResponse.json({ consumption, feed: updatedFeed, stockAlertTriggered });
}
