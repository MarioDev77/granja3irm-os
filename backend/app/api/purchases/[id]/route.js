import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, genId, withTransaction } from '@/lib/db';
import { SECTIONS } from '@/lib/rbac';
import { requireSection, badRequest, notFound } from '@/lib/apiAuth';

const updateSchema = z.object({
  status: z.enum(['PENDING', 'RECEIVED', 'CANCELED']),
});

export async function PATCH(request, { params: __p }) {
  const params = await __p;
  const { session, error } = await requireSection(SECTIONS.PURCHASES);
  if (error) return error;

  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error.errors[0].message);

  const { rows: purchaseRows } = await query(
    `SELECT p.*, s.name AS supplier_name FROM purchases p JOIN suppliers s ON s.id = p.supplier_id WHERE p.id = $1`,
    [params.id]
  );
  const purchase = purchaseRows[0];
  if (!purchase) return notFound('Compra não encontrada.');

  if (purchase.status === 'RECEIVED' && parsed.data.status !== 'RECEIVED') {
    return badRequest('Uma compra já recebida não pode voltar para outro status (o estoque já foi atualizado).');
  }

  const { rows: items } = await query('SELECT * FROM purchase_items WHERE purchase_id = $1', [params.id]);

  await withTransaction(async (client) => {
    await client.query('UPDATE purchases SET status = $1, updated_at = now() WHERE id = $2', [
      parsed.data.status,
      params.id,
    ]);

    // Ao marcar como recebida, cada item vinculado a uma ração incrementa o
    // estoque automaticamente (seção 17 do escopo).
    if (parsed.data.status === 'RECEIVED' && purchase.status !== 'RECEIVED') {
      for (const item of items) {
        if (item.feed_id) {
          await client.query(
            `UPDATE feeds SET current_stock = current_stock + $1, updated_at = now() WHERE id = $2`,
            [item.quantity, item.feed_id]
          );
          await client.query(
            `INSERT INTO feed_movements (id, feed_id, type, quantity, unit_value, supplier_id, document, responsible_id, date)
             VALUES ($1, $2, 'IN', $3, $4, $5, $6, $7, now())`,
            [genId(), item.feed_id, item.quantity, item.unit_value, purchase.supplier_id, `Compra ${purchase.id}`, session.user.id]
          );
        }
      }
    }

    await client.query(
      `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, previous_data, new_data, description)
       VALUES ($1, $2, 'UPDATE', 'Purchase', $3, $4, $5, $6)`,
      [
        genId(), session.user.id, purchase.id,
        JSON.stringify({ status: purchase.status }), JSON.stringify({ status: parsed.data.status }),
        `${session.user.name} atualizou a compra de ${purchase.supplier_name} para o status ${parsed.data.status}.`,
      ]
    );
  });

  return NextResponse.json({ message: 'Compra atualizada.' });
}
