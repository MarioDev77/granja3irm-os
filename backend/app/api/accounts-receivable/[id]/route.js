import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, genId } from '@/lib/db';
import { SECTIONS } from '@/lib/rbac';
import { requireSection, badRequest, notFound } from '@/lib/apiAuth';

const updateSchema = z.object({
  status: z.enum(['OPEN', 'RECEIVED', 'OVERDUE', 'CANCELED']).optional(),
  value: z.coerce.number().positive().optional(),
  dueDate: z.string().min(1).optional(),
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

  const { status, value, dueDate } = parsed.data;
  const finalStatus = status ?? existing.status;

  const { rows } = await query(
    `UPDATE accounts_receivable
     SET value = $1, due_date = $2, status = $3,
         received_at = CASE WHEN $3 = 'RECEIVED' AND received_at IS NULL THEN now() WHEN $3 <> 'RECEIVED' THEN NULL ELSE received_at END,
         updated_at = now()
     WHERE id = $4
     RETURNING id, customer_id AS "customerId", sale_id AS "saleId", value, due_date AS "dueDate",
       received_at AS "receivedAt", status`,
    [value ?? existing.value, dueDate ? new Date(dueDate) : existing.due_date, finalStatus, params.id]
  );
  const receivable = rows[0];

  await query(
    `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, previous_data, new_data, description)
     VALUES ($1, $2, 'UPDATE', 'AccountReceivable', $3, $4, $5, $6)`,
    [
      genId(), session.user.id, receivable.id,
      JSON.stringify({ status: existing.status, value: existing.value, dueDate: existing.due_date }),
      JSON.stringify(parsed.data),
      `${session.user.name} editou uma conta a receber.`,
    ]
  );

  return NextResponse.json({ receivable });
}
