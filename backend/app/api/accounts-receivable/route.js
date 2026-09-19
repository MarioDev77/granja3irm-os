import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, genId } from '@/lib/db';
import { SECTIONS } from '@/lib/rbac';
import { requireSection, badRequest } from '@/lib/apiAuth';

const receivableSchema = z.object({
  customerId: z.string().min(1, 'Selecione o cliente.'),
  value: z.coerce.number().positive('Informe um valor válido.'),
  dueDate: z.string().min(1, 'Informe o vencimento.'),
});

export async function GET() {
  const { error } = await requireSection(SECTIONS.FINANCE);
  if (error) return error;

  await query(`UPDATE accounts_receivable SET status = 'OVERDUE', updated_at = now() WHERE status = 'OPEN' AND due_date < now()`);

  const { rows: receivables } = await query(
    `SELECT
       r.id, r.customer_id AS "customerId", r.sale_id AS "saleId", r.value, r.due_date AS "dueDate",
       r.received_at AS "receivedAt", r.status,
       json_build_object('name', c.name) AS customer,
       CASE WHEN s.id IS NOT NULL THEN json_build_object('id', s.id, 'totalValue', s.total_value) ELSE NULL END AS sale
     FROM accounts_receivable r
     JOIN customers c ON c.id = r.customer_id
     LEFT JOIN sales s ON s.id = r.sale_id
     ORDER BY r.due_date ASC`
  );

  return NextResponse.json({ receivables });
}

export async function POST(request) {
  const { session, error } = await requireSection(SECTIONS.FINANCE);
  if (error) return error;

  const parsed = receivableSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error.errors[0].message);

  const { customerId, value, dueDate } = parsed.data;

  const { rows: customerRows } = await query('SELECT * FROM customers WHERE id = $1', [customerId]);
  const customer = customerRows[0];
  if (!customer) return badRequest('Cliente inválido.');

  const { rows } = await query(
    `INSERT INTO accounts_receivable (id, customer_id, value, due_date)
     VALUES ($1, $2, $3, $4)
     RETURNING id, customer_id AS "customerId", value, due_date AS "dueDate", status`,
    [genId(), customerId, value, new Date(dueDate)]
  );
  const receivable = rows[0];

  await query(
    `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, new_data, description)
     VALUES ($1, $2, 'CREATE', 'AccountReceivable', $3, $4, $5)`,
    [
      genId(), session.user.id, receivable.id, JSON.stringify({ customerId, value, dueDate }),
      `${session.user.name} lançou uma conta a receber de ${customer.name} (R$ ${value.toFixed(2)}).`,
    ]
  );

  return NextResponse.json({ receivable }, { status: 201 });
}
