import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, genId, withTransaction } from '@/lib/db';
import { SECTIONS } from '@/lib/rbac';
import { requireSection, badRequest } from '@/lib/apiAuth';

const itemSchema = z.object({
  product: z.string().min(1, 'Informe o produto.'),
  feedId: z.string().optional().nullable(),
  quantity: z.coerce.number().positive('Quantidade deve ser maior que zero.'),
  unitValue: z.coerce.number().min(0),
});

const purchaseSchema = z.object({
  supplierId: z.string().min(1, 'Selecione o fornecedor.'),
  date: z.string().min(1, 'Informe a data.'),
  paymentMethod: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  discount: z.coerce.number().min(0).default(0),
  items: z.array(itemSchema).min(1, 'Adicione ao menos um item.'),
});

export async function GET() {
  const { error } = await requireSection(SECTIONS.PURCHASES);
  if (error) return error;

  const { rows: purchases } = await query(
    `SELECT
       p.id, p.supplier_id AS "supplierId", p.total_value AS "totalValue", p.discount, p.date,
       p.payment_method AS "paymentMethod", p.due_date AS "dueDate", p.status,
       json_build_object('name', s.name) AS supplier,
       COALESCE((
         SELECT json_agg(json_build_object(
           'id', pi.id, 'product', pi.product, 'feedId', pi.feed_id, 'quantity', pi.quantity,
           'unitValue', pi.unit_value, 'totalValue', pi.total_value
         ) ORDER BY pi.id)
         FROM purchase_items pi WHERE pi.purchase_id = p.id
       ), '[]'::json) AS items
     FROM purchases p
     JOIN suppliers s ON s.id = p.supplier_id
     ORDER BY p.date DESC`
  );

  return NextResponse.json({ purchases });
}

export async function POST(request) {
  const { session, error } = await requireSection(SECTIONS.PURCHASES);
  if (error) return error;

  const parsed = purchaseSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error.errors[0].message);

  const { supplierId, date, paymentMethod, dueDate, discount, items } = parsed.data;

  const { rows: supplierRows } = await query('SELECT * FROM suppliers WHERE id = $1', [supplierId]);
  const supplier = supplierRows[0];
  if (!supplier) return badRequest('Fornecedor inválido.');

  const itemsTotal = items.reduce((sum, i) => sum + i.quantity * i.unitValue, 0);
  const totalValue = Math.max(0, itemsTotal - discount);

  const purchase = await withTransaction(async (client) => {
    const purchaseId = genId();
    const { rows: purchaseRows } = await client.query(
      `INSERT INTO purchases (id, supplier_id, date, payment_method, due_date, discount, total_value)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, supplier_id AS "supplierId", date, payment_method AS "paymentMethod",
         due_date AS "dueDate", discount, total_value AS "totalValue", status`,
      [purchaseId, supplierId, new Date(date), paymentMethod || null, dueDate ? new Date(dueDate) : null, discount, totalValue]
    );
    const createdPurchase = purchaseRows[0];

    const createdItems = [];
    for (const item of items) {
      const { rows: itemRows } = await client.query(
        `INSERT INTO purchase_items (id, purchase_id, product, feed_id, quantity, unit_value, total_value)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, product, feed_id AS "feedId", quantity, unit_value AS "unitValue", total_value AS "totalValue"`,
        [genId(), purchaseId, item.product, item.feedId || null, item.quantity, item.unitValue, item.quantity * item.unitValue]
      );
      createdItems.push(itemRows[0]);
    }

    if (dueDate) {
      await client.query(
        `INSERT INTO accounts_payable (id, description, category, purchase_id, value, due_date)
         VALUES ($1, $2, 'Compra de insumos', $3, $4, $5)`,
        [genId(), `Compra de ${supplier.name}`, purchaseId, totalValue, new Date(dueDate)]
      );
    }

    await client.query(
      `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, new_data, description)
       VALUES ($1, $2, 'CREATE', 'Purchase', $3, $4, $5)`,
      [
        genId(), session.user.id, purchaseId, JSON.stringify({ supplierId, totalValue }),
        `${session.user.name} registrou uma compra de ${supplier.name} no valor de R$ ${totalValue.toFixed(2)}.`,
      ]
    );

    return { ...createdPurchase, items: createdItems };
  });

  return NextResponse.json({ purchase }, { status: 201 });
}
