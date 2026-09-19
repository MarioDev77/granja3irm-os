import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, genId } from '@/lib/db';
import { SECTIONS } from '@/lib/rbac';
import { requireSection, badRequest } from '@/lib/apiAuth';

const customerSchema = z.object({
  name: z.string().min(1, 'Informe o nome do cliente.'),
  document: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email('E-mail inválido.').optional().or(z.literal('')).nullable(),
  address: z.string().optional().nullable(),
  type: z.enum(['INDIVIDUAL', 'MARKET', 'RESTAURANT', 'DISTRIBUTOR', 'WHOLESALER', 'FAIR', 'OTHER']),
  notes: z.string().optional().nullable(),
});

export async function GET() {
  const { error } = await requireSection(SECTIONS.SALES);
  if (error) return error;

  const { rows: customers } = await query(
    `SELECT
       c.id, c.name, c.document, c.phone, c.email, c.address, c.type, c.notes,
       json_build_object('sales', COALESCE((SELECT COUNT(*)::int FROM sales s WHERE s.customer_id = c.id), 0)) AS "_count"
     FROM customers c
     ORDER BY c.name ASC`
  );

  return NextResponse.json({ customers });
}

export async function POST(request) {
  const { session, error } = await requireSection(SECTIONS.SALES);
  if (error) return error;

  const parsed = customerSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error.errors[0].message);

  const { name, document, phone, email, address, type, notes } = parsed.data;

  const { rows } = await query(
    `INSERT INTO customers (id, name, document, phone, email, address, type, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, name, document, phone, email, address, type, notes`,
    [genId(), name, document || null, phone || null, email || null, address || null, type, notes || null]
  );
  const customer = rows[0];

  await query(
    `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, new_data, description)
     VALUES ($1, $2, 'CREATE', 'Customer', $3, $4, $5)`,
    [genId(), session.user.id, customer.id, JSON.stringify(parsed.data), `${session.user.name} cadastrou o cliente ${customer.name}.`]
  );

  return NextResponse.json({ customer }, { status: 201 });
}
