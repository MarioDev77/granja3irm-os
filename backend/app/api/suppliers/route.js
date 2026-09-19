import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, genId } from '@/lib/db';
import { SECTIONS } from '@/lib/rbac';
import { requireSection, badRequest } from '@/lib/apiAuth';

const supplierSchema = z.object({
  name: z.string().min(1, 'Informe o nome do fornecedor.'),
  document: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email('E-mail inválido.').optional().or(z.literal('')).nullable(),
  address: z.string().optional().nullable(),
  products: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET() {
  const { error } = await requireSection(SECTIONS.PURCHASES);
  if (error) return error;

  const { rows: suppliers } = await query(
    `SELECT
       s.id, s.name, s.document, s.phone, s.email, s.address, s.products, s.notes,
       json_build_object('purchases', COALESCE((SELECT COUNT(*)::int FROM purchases p WHERE p.supplier_id = s.id), 0)) AS "_count"
     FROM suppliers s
     ORDER BY s.name ASC`
  );

  return NextResponse.json({ suppliers });
}

export async function POST(request) {
  const { session, error } = await requireSection(SECTIONS.PURCHASES);
  if (error) return error;

  const parsed = supplierSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error.errors[0].message);

  const { name, document, phone, email, address, products, notes } = parsed.data;

  const { rows } = await query(
    `INSERT INTO suppliers (id, name, document, phone, email, address, products, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, name, document, phone, email, address, products, notes`,
    [genId(), name, document || null, phone || null, email || null, address || null, products || null, notes || null]
  );
  const supplier = rows[0];

  await query(
    `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, new_data, description)
     VALUES ($1, $2, 'CREATE', 'Supplier', $3, $4, $5)`,
    [genId(), session.user.id, supplier.id, JSON.stringify(parsed.data), `${session.user.name} cadastrou o fornecedor ${supplier.name}.`]
  );

  return NextResponse.json({ supplier }, { status: 201 });
}
