import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, genId } from '@/lib/db';
import { SECTIONS } from '@/lib/rbac';
import { requireSection, badRequest } from '@/lib/apiAuth';

const CATEGORIES = [
  'Ração', 'Medicamentos', 'Vacinas', 'Energia', 'Água', 'Funcionários',
  'Manutenção', 'Transporte', 'Equipamentos', 'Impostos', 'Outros',
];

const payableSchema = z.object({
  description: z.string().min(1, 'Informe a descrição.'),
  category: z.string().min(1, 'Selecione a categoria.'),
  value: z.coerce.number().positive('Informe um valor válido.'),
  dueDate: z.string().min(1, 'Informe o vencimento.'),
  paymentMethod: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET() {
  const { error } = await requireSection(SECTIONS.FINANCE);
  if (error) return error;

  // Marca como vencida qualquer conta OPEN cujo vencimento já passou —
  // feito na leitura para refletir o estado real sem precisar de um job.
  await query(`UPDATE accounts_payable SET status = 'OVERDUE', updated_at = now() WHERE status = 'OPEN' AND due_date < now()`);

  const { rows: payables } = await query(
    `SELECT id, description, category, purchase_id AS "purchaseId", value, due_date AS "dueDate",
       paid_at AS "paidAt", status, payment_method AS "paymentMethod", notes
     FROM accounts_payable ORDER BY due_date ASC`
  );
  return NextResponse.json({ payables, categories: CATEGORIES });
}

export async function POST(request) {
  const { session, error } = await requireSection(SECTIONS.FINANCE);
  if (error) return error;

  const parsed = payableSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error.errors[0].message);

  const { description, category, value, dueDate, paymentMethod, notes } = parsed.data;

  const { rows } = await query(
    `INSERT INTO accounts_payable (id, description, category, value, due_date, payment_method, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, description, category, value, due_date AS "dueDate", status, payment_method AS "paymentMethod", notes`,
    [genId(), description, category, value, new Date(dueDate), paymentMethod || null, notes || null]
  );
  const payable = rows[0];

  await query(
    `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, new_data, description)
     VALUES ($1, $2, 'CREATE', 'AccountPayable', $3, $4, $5)`,
    [
      genId(), session.user.id, payable.id, JSON.stringify({ description, category, value, dueDate, paymentMethod, notes }),
      `${session.user.name} lançou uma conta a pagar: ${description} (R$ ${value.toFixed(2)}).`,
    ]
  );

  return NextResponse.json({ payable }, { status: 201 });
}
