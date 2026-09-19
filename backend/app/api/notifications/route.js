import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { query } from '@/lib/db';
import { can, SECTIONS } from '@/lib/rbac';

// Prefixos usados nos ids sintéticos dos alertas "ao vivo" gerados abaixo —
// usados no PATCH para diferenciá-los das notificações reais (persistidas
// na tabela `notifications`, cujo id é um UUID sem esses prefixos).
const LIVE_ALERT_PREFIXES = ['payable-', 'receivable-', 'shed-', 'production-drop-'];

// Além dos alertas persistidos (mortalidade, estoque de ração — criados no
// momento do registro), calculamos alertas "ao vivo" que não fazem sentido
// como uma linha fixa no banco: eles refletem o estado atual e mudam
// sozinhos quando a situação é resolvida (conta paga, galpão deslotado
// etc.). São mesclados na mesma lista, com id sintético.
async function computeLiveAlerts(role) {
  const alerts = [];

  if (can(role, SECTIONS.FINANCE)) {
    const [overduePayablesResult, overdueReceivablesResult] = await Promise.all([
      query(`SELECT * FROM accounts_payable WHERE status IN ('OPEN', 'OVERDUE') AND due_date < now()`),
      query(
        `SELECT r.*, c.name AS customer_name FROM accounts_receivable r
         JOIN customers c ON c.id = r.customer_id
         WHERE r.status IN ('OPEN', 'OVERDUE') AND r.due_date < now()`
      ),
    ]);

    for (const p of overduePayablesResult.rows) {
      alerts.push({
        id: `payable-${p.id}`,
        severity: 'CRITICAL',
        title: 'Conta a pagar vencida',
        message: `${p.description}: R$ ${Number(p.value).toFixed(2)}, venceu em ${new Date(p.due_date).toLocaleDateString('pt-BR')}.`,
        category: 'ACCOUNTS_PAYABLE',
        createdAt: p.due_date,
        isRead: false,
        live: true,
      });
    }
    for (const r of overdueReceivablesResult.rows) {
      alerts.push({
        id: `receivable-${r.id}`,
        severity: 'WARNING',
        title: 'Conta a receber atrasada',
        message: `${r.customer_name}: R$ ${Number(r.value).toFixed(2)}, venceu em ${new Date(r.due_date).toLocaleDateString('pt-BR')}.`,
        category: 'ACCOUNTS_RECEIVABLE',
        createdAt: r.due_date,
        isRead: false,
        live: true,
      });
    }
  }

  if (can(role, SECTIONS.PRODUCTION)) {
    const { rows: sheds } = await query(
      `SELECT
         s.id, s.name, s.capacity,
         COALESCE((
           SELECT COUNT(*)::int FROM birds b JOIN flocks f ON f.id = b.flock_id
           WHERE f.shed_id = s.id AND f.status = 'ACTIVE' AND b.status = 'ACTIVE'
         ), 0) AS "currentBirds"
       FROM sheds s WHERE s.deleted_at IS NULL`
    );
    for (const shed of sheds) {
      const occupancy = shed.capacity > 0 ? (shed.currentBirds / shed.capacity) * 100 : 0;
      if (occupancy >= 95) {
        alerts.push({
          id: `shed-${shed.id}`,
          severity: 'WARNING',
          title: 'Capacidade do galpão próxima do limite',
          message: `${shed.name}: ${shed.currentBirds}/${shed.capacity} aves (${occupancy.toFixed(1)}%).`,
          category: 'SHED_CAPACITY',
          createdAt: new Date(),
          isRead: false,
          live: true,
        });
      }
    }

    // Queda de produção: compara a média dos últimos 7 dias com os 7 dias
    // anteriores, por lote ativo. Só alerta se houver dados suficientes
    // nos dois períodos (nunca inventa uma tendência sem histórico real).
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 86_400_000);

    const { rows: activeFlocks } = await query(`SELECT id, name FROM flocks WHERE status = 'ACTIVE'`);
    for (const flock of activeFlocks) {
      const [recentResult, previousResult] = await Promise.all([
        query(
          `SELECT COUNT(*)::int AS count, COALESCE(AVG(good_eggs), 0) AS avg
           FROM egg_productions WHERE flock_id = $1 AND date >= $2`,
          [flock.id, sevenDaysAgo]
        ),
        query(
          `SELECT COUNT(*)::int AS count, COALESCE(AVG(good_eggs), 0) AS avg
           FROM egg_productions WHERE flock_id = $1 AND date >= $2 AND date < $3`,
          [flock.id, fourteenDaysAgo, sevenDaysAgo]
        ),
      ]);
      const recent = recentResult.rows[0];
      const previous = previousResult.rows[0];
      if (recent.count >= 3 && previous.count >= 3 && Number(previous.avg) > 0) {
        const change = ((Number(recent.avg) - Number(previous.avg)) / Number(previous.avg)) * 100;
        if (change <= -10) {
          alerts.push({
            id: `production-drop-${flock.id}`,
            severity: 'WARNING',
            title: 'Queda de produção',
            message: `Lote ${flock.name}: produção média caiu ${Math.abs(change).toFixed(1)}% na última semana.`,
            category: 'PRODUCTION_DROP',
            createdAt: new Date(),
            isRead: false,
            live: true,
          });
        }
      }
    }
  }

  return alerts;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  const [storedResult, live] = await Promise.all([
    query(
      `SELECT id, severity, title, message, category, is_read AS "isRead", created_at AS "createdAt"
       FROM notifications ORDER BY created_at DESC LIMIT 100`
    ),
    computeLiveAlerts(session.user.role),
  ]);

  const notifications = [...live, ...storedResult.rows].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );

  return NextResponse.json({ notifications });
}

export async function PATCH(request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  const { id } = await request.json();

  // Alertas "ao vivo" (id sintético, com um dos prefixos conhecidos) não
  // existem na tabela — não há o que marcar como lido, eles somem sozinhos
  // quando a situação é resolvida.
  if (typeof id === 'string' && LIVE_ALERT_PREFIXES.some((prefix) => id.startsWith(prefix))) {
    return NextResponse.json({ message: 'Alerta calculado automaticamente; será removido quando resolvido.' });
  }

  const { rows } = await query(
    `UPDATE notifications SET is_read = true WHERE id = $1
     RETURNING id, severity, title, message, category, is_read AS "isRead", created_at AS "createdAt"`,
    [id]
  );

  return NextResponse.json({ notification: rows[0] });
}
