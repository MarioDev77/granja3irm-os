import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, genId, withTransaction } from '@/lib/db';
import { SECTIONS, ROLES } from '@/lib/rbac';
import { requireSection, badRequest, notFound } from '@/lib/apiAuth';

const updateSchema = z.object({
  status: z.enum(['PENDING', 'COMPLETED', 'CANCELED']).optional(),
  authorizeNegative: z.boolean().optional(),
  date: z.string().min(1).optional(),
  paymentMethod: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  discount: z.coerce.number().min(0).optional(),
  notes: z.string().optional().nullable(),
});

const INCREASE_TYPES = new Set(['IN', 'RETURN']);

async function currentEggStock(size) {
  const { rows } = await query('SELECT type, quantity FROM egg_inventory_movements WHERE size = $1', [size]);
  return rows.reduce((total, m) => {
    const signed = INCREASE_TYPES.has(m.type) || m.type === 'ADJUSTMENT' ? m.quantity : -m.quantity;
    return total + signed;
  }, 0);
}

export async function PATCH(request, { params: __p }) {
  const params = await __p;
  const { session, error } = await requireSection(SECTIONS.SALES);
  if (error) return error;

  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error.errors[0].message);

  const { rows: saleRows } = await query(
    `SELECT s.*, c.name AS customer_name FROM sales s JOIN customers c ON c.id = s.customer_id WHERE s.id = $1`,
    [params.id]
  );
  const sale = saleRows[0];
  if (!sale) return notFound('Venda não encontrada.');

  const { rows: items } = await query('SELECT * FROM sale_items WHERE sale_id = $1', [params.id]);
  const { status, authorizeNegative, date, paymentMethod, dueDate, discount, notes } = parsed.data;

  if (sale.status === 'COMPLETED' && status !== undefined && status !== 'COMPLETED') {
    return badRequest('Uma venda já confirmada não pode voltar para outro status (o estoque já foi atualizado).');
  }

  const editingHeader = date !== undefined || paymentMethod !== undefined || dueDate !== undefined || discount !== undefined || notes !== undefined;
  if (editingHeader && sale.status === 'COMPLETED') {
    return badRequest('Uma venda já confirmada não pode ter seus dados alterados. Apenas o status pode mudar.');
  }

  const itemsTotal = items.reduce((sum, i) => sum + Number(i.quantity) * Number(i.unit_price), 0);
  const finalDiscount = discount ?? Number(sale.discount);
  const finalTotalValue = Math.max(0, itemsTotal - finalDiscount);

  if (status === 'COMPLETED' && sale.status !== 'COMPLETED') {
    for (const item of items) {
      if (item.egg_size) {
        const stock = await currentEggStock(item.egg_size);
        if (stock - Number(item.quantity) < 0 && !(authorizeNegative && session.user.role === ROLES.ADMIN)) {
          return badRequest(
            `Estoque de ovos (${item.egg_size}) insuficiente para confirmar esta venda. Apenas um administrador pode autorizar.`
          );
        }
      }
    }

    await withTransaction(async (client) => {
      await client.query(`UPDATE sales SET status = 'COMPLETED', updated_at = now() WHERE id = $1`, [params.id]);
      for (const item of items) {
        if (item.egg_size) {
          await client.query(
            `INSERT INTO egg_inventory_movements (id, type, size, quantity, reference, notes)
             VALUES ($1, 'SALE', $2, $3, $4, $5)`,
            [genId(), item.egg_size, Math.round(Number(item.quantity)), sale.id, `Venda para ${sale.customer_name}`]
          );
        }
      }
    });
  } else {
    await withTransaction(async (client) => {
      await client.query(
        `UPDATE sales SET
           date = $1, payment_method = $2, discount = $3, total_value = $4, notes = $5, status = $6, updated_at = now()
         WHERE id = $7`,
        [
          date ? new Date(date) : sale.date,
          paymentMethod !== undefined ? paymentMethod : sale.payment_method,
          finalDiscount,
          finalTotalValue,
          notes !== undefined ? notes : sale.notes,
          status ?? sale.status,
          params.id,
        ]
      );

      if (editingHeader) {
        if (dueDate !== undefined) {
          await client.query(
            `UPDATE accounts_receivable SET value = $1, due_date = $2, updated_at = now()
             WHERE sale_id = $3 AND status = 'OPEN'`,
            [finalTotalValue, dueDate ? new Date(dueDate) : null, params.id]
          );
        } else {
          await client.query(
            `UPDATE accounts_receivable SET value = $1, updated_at = now()
             WHERE sale_id = $2 AND status = 'OPEN'`,
            [finalTotalValue, params.id]
          );
        }
      }
    });
  }

  await query(
    `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, previous_data, new_data, description)
     VALUES ($1, $2, 'UPDATE', 'Sale', $3, $4, $5, $6)`,
    [
      genId(), session.user.id, sale.id,
      JSON.stringify({ status: sale.status, discount: sale.discount }),
      JSON.stringify(parsed.data),
      `${session.user.name} atualizou a venda para ${sale.customer_name}.`,
    ]
  );

  return NextResponse.json({ message: 'Venda atualizada.' });
}
