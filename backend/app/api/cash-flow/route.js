import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, genId } from '@/lib/db';
import { SECTIONS } from '@/lib/rbac';
import { requireSection, badRequest } from '@/lib/apiAuth';

const entrySchema = z.object({
  type: z.enum(['INFLOW', 'OUTFLOW']),
  category: z.string().min(1, 'Informe a categoria.'),
  description: z.string().optional().nullable(),
  value: z.coerce.number().positive('Informe um valor válido.'),
  date: z.string().min(1, 'Informe a data.'),
});

function parsePeriod(searchParams) {
  const preset = searchParams.get('preset') || '30d';
  const now = new Date();
  let start;

  if (searchParams.get('start') && searchParams.get('end')) {
    return { start: new Date(searchParams.get('start')), end: new Date(searchParams.get('end')) };
  }

  switch (preset) {
    case 'today':
      start = new Date(now); start.setHours(0, 0, 0, 0); break;
    case '7d':
      start = new Date(now.getTime() - 7 * 86_400_000); break;
    case '90d':
      start = new Date(now.getTime() - 90 * 86_400_000); break;
    case '6m':
      start = new Date(now); start.setMonth(start.getMonth() - 6); break;
    case '1y':
      start = new Date(now); start.setFullYear(start.getFullYear() - 1); break;
    case '30d':
    default:
      start = new Date(now.getTime() - 30 * 86_400_000);
  }

  return { start, end: now };
}

export async function GET(request) {
  const { error } = await requireSection(SECTIONS.FINANCE);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const { start, end } = parsePeriod(searchParams);

  const [manualEntriesResult, receivedResult, paidResult, priorInflowResult, priorOutflowResult] = await Promise.all([
    query(
      `SELECT id, type, category, description, value, date
       FROM cash_flow_entries WHERE date >= $1 AND date <= $2 ORDER BY date DESC`,
      [start, end]
    ),
    query(
      `SELECT COALESCE(SUM(value), 0) AS total FROM accounts_receivable
       WHERE status = 'RECEIVED' AND received_at >= $1 AND received_at <= $2`,
      [start, end]
    ),
    query(
      `SELECT COALESCE(SUM(value), 0) AS total FROM accounts_payable
       WHERE status = 'PAID' AND paid_at >= $1 AND paid_at <= $2`,
      [start, end]
    ),
    // Saldo inicial: tudo que entrou/saiu ANTES do período selecionado.
    Promise.all([
      query(`SELECT COALESCE(SUM(value), 0) AS total FROM cash_flow_entries WHERE type = 'INFLOW' AND date < $1`, [start]),
      query(`SELECT COALESCE(SUM(value), 0) AS total FROM accounts_receivable WHERE status = 'RECEIVED' AND received_at < $1`, [start]),
    ]),
    Promise.all([
      query(`SELECT COALESCE(SUM(value), 0) AS total FROM cash_flow_entries WHERE type = 'OUTFLOW' AND date < $1`, [start]),
      query(`SELECT COALESCE(SUM(value), 0) AS total FROM accounts_payable WHERE status = 'PAID' AND paid_at < $1`, [start]),
    ]),
  ]);

  const manualEntries = manualEntriesResult.rows;
  const num = (v) => Number(v || 0);

  const openingBalance =
    num(priorInflowResult[0].rows[0].total) +
    num(priorInflowResult[1].rows[0].total) -
    (num(priorOutflowResult[0].rows[0].total) + num(priorOutflowResult[1].rows[0].total));

  const manualInflow = manualEntries.filter((e) => e.type === 'INFLOW').reduce((s, e) => s + Number(e.value), 0);
  const manualOutflow = manualEntries.filter((e) => e.type === 'OUTFLOW').reduce((s, e) => s + Number(e.value), 0);
  const receivedTotal = num(receivedResult.rows[0].total);
  const paidTotal = num(paidResult.rows[0].total);

  const totalInflow = manualInflow + receivedTotal;
  const totalOutflow = manualOutflow + paidTotal;
  const closingBalance = openingBalance + totalInflow - totalOutflow;

  return NextResponse.json({
    period: { start, end },
    openingBalance,
    totalInflow,
    totalOutflow,
    closingBalance,
    entries: manualEntries,
  });
}

export async function POST(request) {
  const { session, error } = await requireSection(SECTIONS.FINANCE);
  if (error) return error;

  const parsed = entrySchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error.errors[0].message);

  const { type, category, description, value, date } = parsed.data;

  const { rows } = await query(
    `INSERT INTO cash_flow_entries (id, type, category, description, value, date)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, type, category, description, value, date`,
    [genId(), type, category, description || null, value, new Date(date)]
  );
  const entry = rows[0];

  await query(
    `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, new_data, description)
     VALUES ($1, $2, 'CREATE', 'CashFlowEntry', $3, $4, $5)`,
    [
      genId(), session.user.id, entry.id, JSON.stringify({ type, category, description, value, date }),
      `${session.user.name} lançou ${type === 'INFLOW' ? 'uma entrada' : 'uma saída'} manual de caixa: ${category} (R$ ${value.toFixed(2)}).`,
    ]
  );

  return NextResponse.json({ entry }, { status: 201 });
}
