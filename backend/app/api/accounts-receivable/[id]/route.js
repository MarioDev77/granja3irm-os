import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, genId } from '@/lib/db';
import { SECTIONS } from '@/lib/rbac';
import { requireSection, badRequest, notFound } from '@/lib/apiAuth';

const updateSchema = z.object({
  status: z.enum(['OPEN', 'RECEIVED', 'OVERDUE', 'CANCELED']),
});

export async function PATCH(request, { params: __p }) {
  const params = await __p;
  const { session, error } = await requireSection(SECTIONS.FINANCE);
  if (error) return error;

  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error.errors[0].message);

  const { rows: existingRows } = await query('SELECT * FROM accounts_receivable WHERE id = $1', [params.id]);
  const existing = existingRows[0];
  if (!existing) return notFound('Conta a receber não encontrada.');

  const { status } = parsed.data;

  const { rows } = await query(
    `UPDATE accounts_receivable
     SET status = $1, received_at = CASE WHEN $1 = 'RECEIVED' THEN now() ELSE received_at END, updated_at = now()
     WHERE id = $2
     RETURNING id, customer_id AS "customerId", sale_id AS "saleId", value, due_date AS "dueDate",
       received_at AS "receivedAt", status`,
    [status, params.id]
  );
  const receivable = rows[0];

  await query(
    `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, previous_data, new_data, description)
     VALUES ($1, $2, 'UPDATE', 'AccountReceivable', $3, $4, $5, $6)`,
    [
      genId(), session.user.id, receivable.id,
      JSON.stringify({ status: existing.status }), JSON.stringify({ status: receivable.status }),
      `${session.user.name} atualizou uma conta a receber para ${receivable.status}.`,
    ]
  );

  return NextResponse.json({ receivable });
}
