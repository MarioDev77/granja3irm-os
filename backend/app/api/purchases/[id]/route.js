import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, genId, withTransaction } from '@/lib/db';
import { SECTIONS } from '@/lib/rbac';
import { requireSection, badRequest, notFound } from '@/lib/apiAuth';

const updateSchema = z.object({
  status: z.enum(['PENDING', 'RECEIVED', 'CANCELED']).optional(),
  date: z.string().min(1).optional(),
  paymentMethod: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  discount: z.coerce.number().min(0).optional(),
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

  const { status, date, paymentMethod, dueDate, discount } = parsed.data;

  if (purchase.status === 'RECEIVED' && status !== undefined && status !== 'RECEIVED') {
    return badRequest('Uma compra já recebida não pode voltar para outro status (o estoque já foi atualizado).');
  }

  // Campos do cabeçalho (data, forma de pagamento, vencimento, desconto) só
  // podem ser corrigidos enquanto a compra ainda não foi recebida — depois
  // disso o estoque e o financeiro já refletem os valores originais (ver
  // seção 7 do escopo: preservar integridade histórica quando já houver
  // efeito financeiro/estoque aplicado).
  const editingHeader = date !== undefined || paymentMethod !== undefined || dueDate !== undefined || discount !== undefined;
  if (editingHeader && purchase.status === 'RECEIVED') {
    return badRequest('Uma compra já recebida não pode ter seus dados alterados. Apenas o status pode mudar.');
  }

  const { rows: items } = await query('SELECT * FROM purchase_items WHERE purchase_id = $1', [params.id]);
  const itemsTotal = items.reduce((sum, i) => sum + Number(i.quantity) * Number(i.unit_value), 0);
  const finalDiscount = discount ?? Number(purchase.discount);
  const finalTotalValue = Math.max(0, itemsTotal - finalDiscount);
  const finalStatus = status ?? purchase.status;

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE purchases SET
         date = $1, payment_method = $2, due_date = $3, discount = $4, total_value = $5, status = $6, updated_at = now()
       WHERE id = $7`,
      [
        date ? new Date(date) : purchase.date,
        paymentMethod !== undefined ? paymentMethod : purchase.payment_method,
        dueDate !== undefined ? (dueDate ? new Date(dueDate) : null) : purchase.due_date,
        finalDiscount,
        finalTotalValue,
        finalStatus,
        params.id,
      ]
    );

    // Mantém a conta a pagar vinculada em sincronia quando o total ou o
    // vencimento mudam (seção 4 do escopo: recalcular valores dependentes).
    if (editingHeader) {
      await client.query(
        `UPDATE accounts_payable SET value = $1, due_date = $2, updated_at = now()
         WHERE purchase_id = $3 AND status = 'OPEN'`,
        [finalTotalValue, dueDate !== undefined ? (dueDate ? new Date(dueDate) : null) : purchase.due_date, params.id]
      );
    }

    // Ao marcar como recebida, cada item vinculado a uma ração incrementa o
    // estoque automaticamente (seção 17 do escopo).
    if (finalStatus === 'RECEIVED' && purchase.status !== 'RECEIVED') {
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
        JSON.stringify({ status: purchase.status, discount: purchase.discount, dueDate: purchase.due_date }),
        JSON.stringify(parsed.data),
        `${session.user.name} atualizou a compra de ${purchase.supplier_name}.`,
      ]
    );
  });

  return NextResponse.json({ message: 'Compra atualizada.' });
}
