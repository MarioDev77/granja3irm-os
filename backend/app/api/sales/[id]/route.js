import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, genId, withTransaction } from '@/lib/db';
import { SECTIONS, ROLES } from '@/lib/rbac';
import { requireSection, badRequest, notFound } from '@/lib/apiAuth';

const updateSchema = z.object({
  status: z.enum(['PENDING', 'COMPLETED', 'CANCELED']),
  authorizeNegative: z.boolean().optional(),
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

  if (sale.status === 'COMPLETED' && parsed.data.status !== 'COMPLETED') {
    return badRequest('Uma venda já confirmada não pode voltar para outro status (o estoque já foi atualizado).');
  }

  if (parsed.data.status === 'COMPLETED' && sale.status !== 'COMPLETED') {
    // Verifica estoque de ovos suficiente para todos os itens com tamanho definido.
    for (const item of items) {
      if (item.egg_size) {
        const stock = await currentEggStock(item.egg_size);
        if (
          stock - Number(item.quantity) < 0 &&
          !(parsed.data.authorizeNegative && session.user.role === ROLES.ADMIN)
        ) {
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
    await query(`UPDATE sales SET status = $1, updated_at = now() WHERE id = $2`, [parsed.data.status, params.id]);
  }

  await query(
    `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, previous_data, new_data, description)
     VALUES ($1, $2, 'UPDATE', 'Sale', $3, $4, $5, $6)`,
    [
      genId(), session.user.id, sale.id,
      JSON.stringify({ status: sale.status }), JSON.stringify({ status: parsed.data.status }),
      `${session.user.name} atualizou a venda para ${sale.customer_name} para o status ${parsed.data.status}.`,
    ]
  );

  return NextResponse.json({ message: 'Venda atualizada.' });
}
