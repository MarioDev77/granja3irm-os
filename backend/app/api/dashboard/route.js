import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { can, SECTIONS } from '@/lib/rbac';
import { requireSection } from '@/lib/apiAuth';

// Dados agregados do painel inicial (dashboard).
//
// Esta lógica antes vivia dentro de app/(app)/dashboard/page.jsx, que
// consultava o Prisma diretamente. Foi movida para o back-end sem alterações
// de regra de negócio; o front-end agora só consome este endpoint.
export const dynamic = 'force-dynamic';

function dayLabel(date) {
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

const num = (v) => Number(v || 0);

async function getWeeklySeries() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - i);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    days.push({ start, end, label: dayLabel(start) });
  }

  const series = await Promise.all(
    days.map(async ({ start, end, label }) => {
      const [eggsResult, feedResult, activeBirdsResult] = await Promise.all([
        query('SELECT COALESCE(SUM(good_eggs), 0)::int AS total FROM egg_productions WHERE date >= $1 AND date < $2', [start, end]),
        query('SELECT COALESCE(SUM(quantity), 0) AS total FROM feed_consumptions WHERE date >= $1 AND date < $2', [start, end]),
        query(`SELECT COUNT(*)::int AS count FROM birds WHERE status = 'ACTIVE' AND created_at < $1`, [end]),
      ]);
      return {
        day: label,
        ovos: eggsResult.rows[0].total,
        racao: num(feedResult.rows[0].total),
        animais: activeBirdsResult.rows[0].count,
      };
    })
  );

  return series;
}

async function getTopFlocks() {
  const { rows: flocks } = await query(
    `SELECT f.id, f.name, f.code, f.entry_date AS "entryDate", f.initial_quantity AS "initialQuantity"
     FROM flocks f WHERE f.status = 'ACTIVE' ORDER BY f.entry_date DESC LIMIT 4`
  );

  return Promise.all(
    flocks.map(async (flock) => {
      const [activeBirdsResult, totalMortalityResult] = await Promise.all([
        query(`SELECT COUNT(*)::int AS count FROM birds WHERE flock_id = $1 AND status = 'ACTIVE'`, [flock.id]),
        query('SELECT COALESCE(SUM(quantity), 0)::int AS total FROM mortality_records WHERE flock_id = $1', [flock.id]),
      ]);
      const activeBirds = activeBirdsResult.rows[0].count;
      const mortalityTotal = totalMortalityResult.rows[0].total;
      const mortalityRate =
        flock.initialQuantity > 0 ? Math.round((mortalityTotal / flock.initialQuantity) * 1000) / 10 : 0;
      const ageDays = Math.max(0, Math.floor((Date.now() - new Date(flock.entryDate).getTime()) / 86_400_000));

      return {
        id: flock.id,
        name: flock.name,
        code: flock.code,
        activeBirds,
        ageWeeks: Math.round(ageDays / 7),
        mortalityRate,
      };
    })
  );
}

async function getDashboardData(includeFinance) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [
    shedCountResult,
    activeFlockCountResult,
    activeBirdCountResult,
    todayEggResult,
    monthMortalityResult,
    totalUsersResult,
    weeklySeries,
    topFlocks,
    recentAlertsResult,
    unreadAlertsResult,
  ] = await Promise.all([
    query('SELECT COUNT(*)::int AS count FROM sheds WHERE deleted_at IS NULL'),
    query(`SELECT COUNT(*)::int AS count FROM flocks WHERE status = 'ACTIVE'`),
    query(`SELECT COUNT(*)::int AS count FROM birds WHERE status = 'ACTIVE'`),
    query('SELECT COALESCE(SUM(good_eggs), 0)::int AS total FROM egg_productions WHERE date >= $1', [startOfDay]),
    query('SELECT COALESCE(SUM(quantity), 0)::int AS total FROM mortality_records WHERE date >= $1', [startOfMonth]),
    query('SELECT COUNT(*)::int AS count FROM users WHERE deleted_at IS NULL'),
    getWeeklySeries(),
    getTopFlocks(),
    query(
      `SELECT id, severity, title, message, category, is_read AS "isRead", created_at AS "createdAt"
       FROM notifications WHERE is_read = false ORDER BY created_at DESC LIMIT 4`
    ),
    query('SELECT COUNT(*)::int AS count FROM notifications WHERE is_read = false'),
  ]);

  const shedCount = shedCountResult.rows[0].count;
  const activeFlockCount = activeFlockCountResult.rows[0].count;
  const activeBirdCount = activeBirdCountResult.rows[0].count;
  const totalUsers = totalUsersResult.rows[0].count;
  const recentAlerts = recentAlertsResult.rows;
  const unreadAlerts = unreadAlertsResult.rows[0].count;

  const hasAnyProductionData = shedCount > 0 || activeFlockCount > 0 || activeBirdCount > 0;

  let finance = null;
  if (includeFinance) {
    const [receivedResult, paidResult, openPayableResult, openReceivableResult] = await Promise.all([
      query(`SELECT COALESCE(SUM(value), 0) AS total FROM accounts_receivable WHERE status = 'RECEIVED' AND received_at >= $1`, [startOfMonth]),
      query(`SELECT COALESCE(SUM(value), 0) AS total FROM accounts_payable WHERE status = 'PAID' AND paid_at >= $1`, [startOfMonth]),
      query(`SELECT COALESCE(SUM(value), 0) AS total FROM accounts_payable WHERE status IN ('OPEN', 'OVERDUE')`),
      query(`SELECT COALESCE(SUM(value), 0) AS total FROM accounts_receivable WHERE status IN ('OPEN', 'OVERDUE')`),
    ]);

    const revenue = num(receivedResult.rows[0].total);
    const expenses = num(paidResult.rows[0].total);

    finance = {
      revenue,
      expenses,
      profit: revenue - expenses,
      openPayable: num(openPayableResult.rows[0].total),
      openReceivable: num(openReceivableResult.rows[0].total),
    };
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000);
  const fourteenDaysAgo = new Date(Date.now() - 14 * 86_400_000);

  const [recentEggsR, previousEggsR, recentFeedR, previousFeedR, latestCostR] = await Promise.all([
    query('SELECT COUNT(*)::int AS count, COALESCE(SUM(good_eggs), 0) AS total FROM egg_productions WHERE date >= $1', [sevenDaysAgo]),
    query('SELECT COUNT(*)::int AS count, COALESCE(SUM(good_eggs), 0) AS total FROM egg_productions WHERE date >= $1 AND date < $2', [fourteenDaysAgo, sevenDaysAgo]),
    query('SELECT COUNT(*)::int AS count, COALESCE(SUM(quantity), 0) AS total FROM feed_consumptions WHERE date >= $1', [sevenDaysAgo]),
    query('SELECT COUNT(*)::int AS count, COALESCE(SUM(quantity), 0) AS total FROM feed_consumptions WHERE date >= $1 AND date < $2', [fourteenDaysAgo, sevenDaysAgo]),
    query('SELECT feed_cost AS "feedCost", medication_cost AS "medicationCost", labor_cost AS "laborCost", energy_cost AS "energyCost", water_cost AS "waterCost", other_cost AS "otherCost" FROM production_costs ORDER BY reference_month DESC LIMIT 1'),
  ]);

  const recentEggs = recentEggsR.rows[0];
  const previousEggs = previousEggsR.rows[0];
  const recentFeed = recentFeedR.rows[0];
  const previousFeed = previousFeedR.rows[0];
  const latestCost = latestCostR.rows[0] || null;

  const insights = [];
  let eggTrend = null;
  let feedTrend = null;

  if (recentEggs.count >= 2 && previousEggs.count >= 2 && num(previousEggs.total) > 0) {
    eggTrend = ((num(recentEggs.total) - num(previousEggs.total)) / num(previousEggs.total)) * 100;
    insights.push(
      `Produção de ovos ${eggTrend >= 0 ? 'aumentou' : 'caiu'} ${Math.abs(eggTrend).toFixed(1)}% na última semana em relação à anterior.`
    );
  }

  if (recentFeed.count >= 2 && previousFeed.count >= 2 && num(previousFeed.total) > 0) {
    feedTrend = ((num(recentFeed.total) - num(previousFeed.total)) / num(previousFeed.total)) * 100;
    insights.push(`Consumo de ração ${feedTrend >= 0 ? 'aumentou' : 'diminuiu'} ${Math.abs(feedTrend).toFixed(1)}% na última semana.`);
  }

  if (latestCost) {
    const totalCost =
      num(latestCost.feedCost) + num(latestCost.medicationCost) + num(latestCost.laborCost) +
      num(latestCost.energyCost) + num(latestCost.waterCost) + num(latestCost.otherCost);
    if (totalCost > 0) {
      const feedShare = (num(latestCost.feedCost) / totalCost) * 100;
      insights.push(`Os custos de alimentação representam ${feedShare.toFixed(0)}% dos custos de produção do último mês lançado.`);
    }
  }

  if (unreadAlerts > 0) {
    insights.push(`Há ${unreadAlerts} alerta${unreadAlerts > 1 ? 's' : ''} não lido${unreadAlerts > 1 ? 's' : ''} para revisar.`);
  }

  return {
    shedCount,
    activeFlockCount,
    activeBirdCount,
    todayEggs: todayEggResult.rows[0].total,
    monthMortality: monthMortalityResult.rows[0].total,
    totalUsers,
    hasAnyProductionData,
    finance,
    insights,
    weeklySeries,
    topFlocks,
    recentAlerts,
    unreadAlerts,
    eggTrend,
    feedTrend,
  };
}

export async function GET() {
  const { session, error } = await requireSection(SECTIONS.DASHBOARD);
  if (error) return error;

  // Números financeiros só são calculados/enviados para perfis com acesso
  // à seção Financeiro (mesma regra que já existia na página).
  const includeFinance = can(session.user.role, SECTIONS.FINANCE);
  const data = await getDashboardData(includeFinance);

  return NextResponse.json(data);
}
