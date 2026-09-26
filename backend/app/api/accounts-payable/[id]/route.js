import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, genId } from '@/lib/db';
import { SECTIONS } from '@/lib/rbac';
import { requireSection, badRequest, notFound } from '@/lib/apiAuth';

const updateSchema = z.object({
  status: z.enum(['OPEN', 'PAID', 'OVERDUE', 'CANCELED']).optional(),
  paymentMethod: z.string().optional().nullable(),
  description: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  value: z.coerce.number().positive().optional(),
  dueDate: z.string().min(1).optional(),
  notes: z.string().optional().nullable(),
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

  const { status, paymentMethod, description, category, value, dueDate, notes } = parsed.data;
  const finalStatus = status ?? existing.status;

  const { rows } = await query(
    `UPDATE accounts_payable
     SET description = $1, category = $2, value = $3, due_date = $4, notes = $5,
         status = $6, payment_method = $7,
         paid_at = CASE WHEN $6 = 'PAID' AND paid_at IS NULL THEN now() WHEN $6 <> 'PAID' THEN NULL ELSE paid_at END,
         updated_at = now()
     WHERE id = $8
     RETURNING id, description, category, purchase_id AS "purchaseId", value, due_date AS "dueDate",
       paid_at AS "paidAt", status, payment_method AS "paymentMethod", notes`,
    [
      description ?? existing.description,
      category ?? existing.category,
      value ?? existing.value,
      dueDate ? new Date(dueDate) : existing.due_date,
      notes !== undefined ? notes : existing.notes,
      finalStatus,
      paymentMethod !== undefined ? paymentMethod : existing.payment_method,
      params.id,
    ]
  );
  const payable = rows[0];

  await query(
    `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, previous_data, new_data, description)
     VALUES ($1, $2, 'UPDATE', 'AccountPayable', $3, $4, $5, $6)`,
    [
      genId(), session.user.id, payable.id,
      JSON.stringify({ status: existing.status, value: existing.value, dueDate: existing.due_date }),
      JSON.stringify(parsed.data),
      `${session.user.name} editou a conta a pagar "${payable.description}".`,
    ]
  );

  return NextResponse.json({ payable });
}
