import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, genId } from '@/lib/db';
import { SECTIONS } from '@/lib/rbac';
import { requireSection, badRequest, notFound } from '@/lib/apiAuth';

const updateSchema = z.object({
  status: z.enum(['OPEN', 'PAID', 'OVERDUE', 'CANCELED']),
  paymentMethod: z.string().optional().nullable(),
});

export async function PATCH(request, { params: __p }) {
  const params = await __p;
  const { session, error } = await requireSection(SECTIONS.FINANCE);
  if (error) return error;

  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error.errors[0].message);

  const { rows: existingRows } = await query('SELECT * FROM accounts_payable WHERE id = $1', [params.id]);
  const existing = existingRows[0];
  if (!existing) return notFound('Conta a pagar não encontrada.');

  const { status, paymentMethod } = parsed.data;

  const { rows } = await query(
    `UPDATE accounts_payable
     SET status = $1, payment_method = $2, paid_at = CASE WHEN $1 = 'PAID' THEN now() ELSE paid_at END, updated_at = now()
     WHERE id = $3
     RETURNING id, description, category, purchase_id AS "purchaseId", value, due_date AS "dueDate",
       paid_at AS "paidAt", status, payment_method AS "paymentMethod", notes`,
    [status, paymentMethod ?? existing.payment_method, params.id]
  );
  const payable = rows[0];

  await query(
    `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, previous_data, new_data, description)
     VALUES ($1, $2, 'UPDATE', 'AccountPayable', $3, $4, $5, $6)`,
    [
      genId(), session.user.id, payable.id,
      JSON.stringify({ status: existing.status }), JSON.stringify({ status: payable.status }),
      `${session.user.name} atualizou a conta a pagar "${existing.description}" para ${payable.status}.`,
    ]
  );

  return NextResponse.json({ payable });
}
