import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, genId } from '@/lib/db';
import { SECTIONS } from '@/lib/rbac';
import { requireSection, badRequest, notFound } from '@/lib/apiAuth';

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  document: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal('')).nullable(),
  address: z.string().optional().nullable(),
  type: z.enum(['INDIVIDUAL', 'MARKET', 'RESTAURANT', 'DISTRIBUTOR', 'WHOLESALER', 'FAIR', 'OTHER']).optional(),
  notes: z.string().optional().nullable(),
});

const COLUMN_BY_FIELD = {
  name: 'name', document: 'document', phone: 'phone', email: 'email',
  address: 'address', type: 'type', notes: 'notes',
};

export async function PATCH(request, { params: __p }) {
  const params = await __p;
  const { session, error } = await requireSection(SECTIONS.SALES);
  if (error) return error;

  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error.errors[0].message);

  const { rows: existingRows } = await query('SELECT * FROM customers WHERE id = $1', [params.id]);
  const existing = existingRows[0];
  if (!existing) return notFound('Cliente não encontrado.');

  const entries = Object.entries(parsed.data);
  if (entries.length === 0) {
    return NextResponse.json({ customer: existing });
  }

  const fields = [];
  const values = [];
  let i = 1;
  for (const [key, value] of entries) {
    fields.push(`${COLUMN_BY_FIELD[key]} = $${i}`);
    values.push(value);
    i += 1;
  }
  fields.push('updated_at = now()');
  values.push(params.id);

  const { rows } = await query(
    `UPDATE customers SET ${fields.join(', ')} WHERE id = $${i}
     RETURNING id, name, document, phone, email, address, type, notes`,
    values
  );
  const customer = rows[0];

  await query(
    `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, new_data, description)
     VALUES ($1, $2, 'UPDATE', 'Customer', $3, $4, $5)`,
    [genId(), session.user.id, customer.id, JSON.stringify(parsed.data), `${session.user.name} atualizou o cliente ${customer.name}.`]
  );

  return NextResponse.json({ customer });
}
