import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { query } from '@/lib/db';
import { can, SECTIONS } from '@/lib/rbac';

// Cada relatório exige a seção equivalente ao seu domínio, não apenas
// "REPORTS" — assim um Financeiro não vê relatórios de RH e um Gerente sem
// acesso Financeiro não vê relatórios de custos, por exemplo.
const REPORT_SECTION = {
  'production-daily': SECTIONS.PRODUCTION,
  'production-by-flock': SECTIONS.PRODUCTION,
  'birds-summary': SECTIONS.PRODUCTION,
  'feed-consumption': SECTIONS.STOCK,
  'financial-summary': SECTIONS.FINANCE,
  'sales-top-products': SECTIONS.SALES,
  'sales-top-customers': SECTIONS.SALES,
};

function fmtDate(d) {
  return new Date(d).toLocaleDateString('pt-BR');
}

// Retorna { start, end } ou null (equivalente ao antigo `{ gte, lte }` do Prisma).
function periodFilter(searchParams) {
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  if (!start || !end) return null;
  const endOfDay = new Date(end);
  endOfDay.setHours(23, 59, 59, 999);
  return { start: new Date(start), end: endOfDay };
}

export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const requiredSection = REPORT_SECTION[type];

  if (!requiredSection || !can(session.user.role, requiredSection) || !can(session.user.role, SECTIONS.REPORTS)) {
    return NextResponse.json({ error: 'Você não tem permissão para este relatório.' }, { status: 403 });
  }

  const period = periodFilter(searchParams);

  switch (type) {
    case 'production-daily': {
      const { rows: records } = await query(
        `SELECT ep.date, ep.good_eggs AS "goodEggs", ep.broken_eggs AS "brokenEggs",
           ep.dirty_eggs AS "dirtyEggs", ep.discarded_eggs AS "discardedEggs",
           f.name AS flock_name, f.code AS flock_code
         FROM egg_productions ep
         JOIN flocks f ON f.id = ep.flock_id
         WHERE ($1::timestamptz IS NULL OR (ep.date >= $1 AND ep.date <= $2))
         ORDER BY ep.date DESC
         LIMIT 500`,
        [period?.start ?? null, period?.end ?? null]
      );
      return NextResponse.json({
        title: 'Produção diária de ovos',
        headers: ['Data', 'Lote', 'Ovos bons', 'Quebrados', 'Sujos', 'Descartados'],
        rows: records.map((r) => [
          fmtDate(r.date), `${r.flock_name} (${r.flock_code})`, r.goodEggs, r.brokenEggs, r.dirtyEggs, r.discardedEggs,
        ]),
      });
    }

    case 'production-by-flock': {
      const { rows: flocks } = await query('SELECT * FROM flocks ORDER BY entry_date DESC');
      const rows = await Promise.all(
        flocks.map(async (f) => {
          const [eggSumResult, mortalitySumResult, activeBirdsResult] = await Promise.all([
            query('SELECT COALESCE(SUM(good_eggs), 0)::int AS total FROM egg_productions WHERE flock_id = $1', [f.id]),
            query('SELECT COALESCE(SUM(quantity), 0)::int AS total FROM mortality_records WHERE flock_id = $1', [f.id]),
            query(`SELECT COUNT(*)::int AS count FROM birds WHERE flock_id = $1 AND status = 'ACTIVE'`, [f.id]),
          ]);
          const mortalityTotal = mortalitySumResult.rows[0].total;
          const mortalityRate = f.initial_quantity > 0 ? ((mortalityTotal / f.initial_quantity) * 100).toFixed(1) : '0.0';
          return [f.name, f.code, activeBirdsResult.rows[0].count, eggSumResult.rows[0].total, `${mortalityRate}%`];
        })
      );
      return NextResponse.json({
        title: 'Produção por lote',
        headers: ['Lote', 'Código', 'Aves ativas', 'Ovos acumulados', 'Taxa de mortalidade'],
        rows,
      });
    }

    case 'birds-summary': {
      const statuses = ['ACTIVE', 'SOLD', 'DEAD', 'DISCARDED', 'TRANSFERRED'];
      const labels = { ACTIVE: 'Ativa', SOLD: 'Vendida', DEAD: 'Morta', DISCARDED: 'Descartada', TRANSFERRED: 'Transferida' };
      const counts = await Promise.all(
        statuses.map((s) => query('SELECT COUNT(*)::int AS count FROM birds WHERE status = $1', [s]))
      );
      return NextResponse.json({
        title: 'Resumo de aves',
        headers: ['Status', 'Quantidade'],
        rows: statuses.map((s, i) => [labels[s], counts[i].rows[0].count]),
      });
    }

    case 'feed-consumption': {
      const { rows: records } = await query(
        `SELECT fc.date, fc.quantity, f.name AS flock_name, fe.name AS feed_name, fe.unit AS feed_unit,
           fe.average_price AS feed_average_price
         FROM feed_consumptions fc
         JOIN flocks f ON f.id = fc.flock_id
         JOIN feeds fe ON fe.id = fc.feed_id
         WHERE ($1::timestamptz IS NULL OR (fc.date >= $1 AND fc.date <= $2))
         ORDER BY fc.date DESC
         LIMIT 500`,
        [period?.start ?? null, period?.end ?? null]
      );
      return NextResponse.json({
        title: 'Consumo de ração',
        headers: ['Data', 'Lote', 'Ração', 'Quantidade', 'Custo estimado'],
        rows: records.map((r) => [
          fmtDate(r.date), r.flock_name, r.feed_name,
          `${Number(r.quantity).toLocaleString('pt-BR')} ${r.feed_unit}`,
          r.feed_average_price ? `R$ ${(Number(r.quantity) * Number(r.feed_average_price)).toFixed(2)}` : '—',
        ]),
      });
    }

    case 'financial-summary': {
      const [payablesResult, receivablesResult] = await Promise.all([
        query(
          `SELECT value, status FROM accounts_payable WHERE $1::timestamptz IS NULL OR (due_date >= $1 AND due_date <= $2)`,
          [period?.start ?? null, period?.end ?? null]
        ),
        query(
          `SELECT value, status FROM accounts_receivable WHERE $1::timestamptz IS NULL OR (due_date >= $1 AND due_date <= $2)`,
          [period?.start ?? null, period?.end ?? null]
        ),
      ]);
      const payables = payablesResult.rows;
      const receivables = receivablesResult.rows;
      const totalPayable = payables.reduce((s, p) => s + Number(p.value), 0);
      const totalReceivable = receivables.reduce((s, r) => s + Number(r.value), 0);
      const paidTotal = payables.filter((p) => p.status === 'PAID').reduce((s, p) => s + Number(p.value), 0);
      const receivedTotal = receivables.filter((r) => r.status === 'RECEIVED').reduce((s, r) => s + Number(r.value), 0);
      return NextResponse.json({
        title: 'Resumo financeiro',
        headers: ['Indicador', 'Valor'],
        rows: [
          ['Total de contas a pagar no período', `R$ ${totalPayable.toFixed(2)}`],
          ['Já pago', `R$ ${paidTotal.toFixed(2)}`],
          ['Total de contas a receber no período', `R$ ${totalReceivable.toFixed(2)}`],
          ['Já recebido', `R$ ${receivedTotal.toFixed(2)}`],
          ['Resultado (recebido - pago)', `R$ ${(receivedTotal - paidTotal).toFixed(2)}`],
        ],
      });
    }

    case 'sales-top-products': {
      const { rows: items } = await query(
        `SELECT si.product, si.quantity, si.total_value AS "totalValue"
         FROM sale_items si JOIN sales s ON s.id = si.sale_id
         WHERE $1::timestamptz IS NULL OR (s.date >= $1 AND s.date <= $2)`,
        [period?.start ?? null, period?.end ?? null]
      );
      const byProduct = {};
      for (const i of items) {
        const key = i.product;
        byProduct[key] = byProduct[key] || { quantity: 0, total: 0 };
        byProduct[key].quantity += Number(i.quantity);
        byProduct[key].total += Number(i.totalValue);
      }
      const rows = Object.entries(byProduct)
        .sort((a, b) => b[1].total - a[1].total)
        .map(([product, v]) => [product, v.quantity.toLocaleString('pt-BR'), `R$ ${v.total.toFixed(2)}`]);
      return NextResponse.json({ title: 'Produtos mais vendidos', headers: ['Produto', 'Quantidade', 'Faturamento'], rows });
    }

    case 'sales-top-customers': {
      const { rows: sales } = await query(
        `SELECT s.total_value AS "totalValue", c.name AS customer_name
         FROM sales s JOIN customers c ON c.id = s.customer_id
         WHERE $1::timestamptz IS NULL OR (s.date >= $1 AND s.date <= $2)`,
        [period?.start ?? null, period?.end ?? null]
      );
      const byCustomer = {};
      for (const s of sales) {
        const key = s.customer_name;
        byCustomer[key] = (byCustomer[key] || 0) + Number(s.totalValue);
      }
      const rows = Object.entries(byCustomer)
        .sort((a, b) => b[1] - a[1])
        .map(([name, total]) => [name, `R$ ${total.toFixed(2)}`]);
      return NextResponse.json({ title: 'Clientes que mais compram', headers: ['Cliente', 'Faturamento'], rows });
    }

    default:
      return NextResponse.json({ error: 'Relatório desconhecido.' }, { status: 400 });
  }
}
