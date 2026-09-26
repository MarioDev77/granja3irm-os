import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, genId, withTransaction } from '@/lib/db';
import { SECTIONS, ROLES } from '@/lib/rbac';
import { requireSection, badRequest, notFound } from '@/lib/apiAuth';

const updateSchema = z.object({
  feedId: z.string().min(1).optional(),
  type: z.enum(['IN', 'OUT']).optional(),
  quantity: z.coerce.number().positive().optional(),
  unitValue: z.coerce.number().min(0).optional().nullable(),
  document: z.string().optional().nullable(),
  shedId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  date: z.string().min(1).optional(),
  authorizeNegative: z.boolean().optional(),
});

function signedDelta(type, quantity) {
  return type === 'IN' ? Number(quantity) : -Number(quantity);
}

export async function PATCH(request, { params: __p }) {
  const params = await __p;
  const { session, error } = await requireSection(SECTIONS.STOCK);
  if (error) return error;

  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error.errors[0].message);

  const { rows: existingRows } = await query('SELECT * FROM feed_movements WHERE id = $1', [params.id]);
  const existing = existingRows[0];
  if (!existing) return notFound('Movimentação de ração não encontrada.');

  const { feedId, type, quantity, unitValue, document, shedId, notes, date, authorizeNegative } = parsed.data;
  const targetFeedId = feedId ?? existing.feed_id;
  const targetType = type ?? existing.type;
  const targetQuantity = quantity ?? Number(existing.quantity);

  const { rows: feedRows } = await query('SELECT * FROM feeds WHERE id = $1', [targetFeedId]);
  const feed = feedRows[0];
  if (!feed) return badRequest('Ração inválida.');

  // Reverte o efeito antigo (se a movimentação ficar na mesma ração) e
  // aplica o novo delta.
  let baseStock = Number(feed.current_stock);
  if (existing.feed_id === targetFeedId) {
    baseStock -= signedDelta(existing.type, existing.quantity);
  }
  const resultingStock = baseStock + signedDelta(targetType, targetQuantity);

  if (resultingStock < 0 && !(authorizeNegative && session.user.role === ROLES.ADMIN)) {
    return badRequest(
      'Estoque insuficiente para esta alteração. Apenas um administrador pode autorizar estoque negativo.'
    );
  }

  const { movement, updatedFeed } = await withTransaction(async (client) => {
    if (existing.feed_id !== targetFeedId) {
      await client.query(
        'UPDATE feeds SET current_stock = current_stock - $1, updated_at = now() WHERE id = $2',
        [signedDelta(existing.type, existing.quantity), existing.feed_id]
      );
    }

    const { rows: movementRows } = await client.query(
      `UPDATE feed_movements SET
         feed_id = $1, type = $2, quantity = $3, unit_value = $4, document = $5, shed_id = $6, notes = $7, date = $8, updated_at = now()
       WHERE id = $9
       RETURNING id, feed_id AS "feedId", type, quantity, unit_value AS "unitValue", document,
         shed_id AS "shedId", notes, date, responsible_id AS "responsibleId"`,
      [
        targetFeedId,
        targetType,
        targetQuantity,
        unitValue !== undefined ? unitValue : existing.unit_value,
        document !== undefined ? document : existing.document,
        shedId !== undefined ? shedId : existing.shed_id,
        notes !== undefined ? notes : existing.notes,
        date ? new Date(date) : existing.date,
        params.id,
      ]
    );

    const { rows: feedUpdateRows } = await client.query(
      `UPDATE feeds SET current_stock = $1, updated_at = now() WHERE id = $2
       RETURNING id, name, unit, current_stock AS "currentStock", minimum_stock AS "minimumStock"`,
      [resultingStock, targetFeedId]
    );

    await client.query(
      `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, previous_data, new_data, description)
       VALUES ($1, $2, 'UPDATE', 'FeedMovement', $3, $4, $5, $6)`,
      [
        genId(), session.user.id, movementRows[0].id,
        JSON.stringify({ type: existing.type, quantity: existing.quantity, feedId: existing.feed_id }),
        JSON.stringify(parsed.data),
        `${session.user.name} editou uma movimentação de estoque de ração.`,
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

  return NextResponse.json({ movement, feed: updatedFeed, stockAlertTriggered });
}
