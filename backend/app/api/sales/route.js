import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, genId, withTransaction } from '@/lib/db';
import { SECTIONS } from '@/lib/rbac';
import { requireSection, badRequest } from '@/lib/apiAuth';

const itemSchema = z.object({
  product: z.string().min(1, 'Informe o produto.'),
  eggSize: z.enum(['SMALL', 'MEDIUM', 'LARGE', 'EXTRA', 'JUMBO']).optional().nullable(),
  quantity: z.coerce.number().positive('Quantidade deve ser maior que zero.'),
  unitPrice: z.coerce.number().min(0),
});

const saleSchema = z.object({
  customerId: z.string().min(1, 'Selecione o cliente.'),
  date: z.string().min(1, 'Informe a data.'),
  paymentMethod: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  discount: z.coerce.number().min(0).default(0),
  notes: z.string().optional().nullable(),
  items: z.array(itemSchema).min(1, 'Adicione ao menos um item.'),
});

export async function GET() {
  const { error } = await requireSection(SECTIONS.SALES);
  if (error) return error;

  const { rows: sales } = await query(
    `SELECT
       s.id, s.customer_id AS "customerId", s.total_value AS "totalValue", s.discount, s.date,
       s.payment_method AS "paymentMethod", s.status, s.notes,
       json_build_object('name', c.name) AS customer,
       COALESCE((
         SELECT json_agg(json_build_object(
           'id', si.id, 'product', si.product, 'eggSize', si.egg_size, 'quantity', si.quantity,
           'unitPrice', si.unit_price, 'discount', si.discount, 'totalValue', si.total_value
         ) ORDER BY si.id)
         FROM sale_items si WHERE si.sale_id = s.id
       ), '[]'::json) AS items
     FROM sales s
     JOIN customers c ON c.id = s.customer_id
     ORDER BY s.date DESC`
  );

  return NextResponse.json({ sales });
}

export async function POST(request) {
  const { session, error } = await requireSection(SECTIONS.SALES);
  if (error) return error;

  const parsed = saleSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error.errors[0].message);

  const { customerId, date, paymentMethod, dueDate, discount, notes, items } = parsed.data;

  const { rows: customerRows } = await query('SELECT * FROM customers WHERE id = $1', [customerId]);
  const customer = customerRows[0];
  if (!customer) return badRequest('Cliente inválido.');

  const itemsTotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const totalValue = Math.max(0, itemsTotal - discount);

  const sale = await withTransaction(async (client) => {
    const saleId = genId();
    const { rows: saleRows } = await client.query(
      `INSERT INTO sales (id, customer_id, date, payment_method, discount, total_value, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, customer_id AS "customerId", date, payment_method AS "paymentMethod",
         discount, total_value AS "totalValue", notes, status`,
      [saleId, customerId, new Date(date), paymentMethod || null, discount, totalValue, notes || null]
    );
    const createdSale = saleRows[0];

    const createdItems = [];
    for (const item of items) {
      const { rows: itemRows } = await client.query(
        `INSERT INTO sale_items (id, sale_id, product, egg_size, quantity, unit_price, total_value)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, product, egg_size AS "eggSize", quantity, unit_price AS "unitPrice", total_value AS "totalValue"`,
        [genId(), saleId, item.product, item.eggSize || null, item.quantity, item.unitPrice, item.quantity * item.unitPrice]
      );
      createdItems.push(itemRows[0]);
    }

    if (dueDate) {
      await client.query(
        `INSERT INTO accounts_receivable (id, customer_id, sale_id, value, due_date)
         VALUES ($1, $2, $3, $4, $5)`,
        [genId(), customerId, saleId, totalValue, new Date(dueDate)]
      );
    }

    await client.query(
      `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, new_data, description)
       VALUES ($1, $2, 'CREATE', 'Sale', $3, $4, $5)`,
      [
        genId(), session.user.id, saleId, JSON.stringify({ customerId, totalValue }),
        `${session.user.name} registrou uma venda para ${customer.name} no valor de R$ ${totalValue.toFixed(2)}.`,
      ]
    );

    return { ...createdSale, items: createdItems };
  });

  return NextResponse.json({ sale }, { status: 201 });
}
