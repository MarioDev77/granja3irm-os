'use client';

import { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { CartesianGrid, Legend, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import ChartCard from './ChartCard';

function monthKey(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function monthLabel(key) {
  const [y, m] = key.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '');
}

/**
 * Cruza mortalidade e produção de ovos por mês (linha dupla, dois eixos Y),
 * mostra o custo médio de ração por ave no mês corrente, e alerta quando a
 * mortalidade do mês está acima da média histórica.
 *
 * mortalityRecords: /api/mortality -> records
 * eggRecords: /api/egg-production -> records
 * consumptionRecords: /api/feed-consumption -> consumptions (já traz cost/costPerBird)
 */
export default function OperationalCharts({ mortalityRecords = [], eggRecords = [], consumptionRecords = [] }) {
  const byMonth = useMemo(() => {
    const map = new Map();
    for (const r of mortalityRecords) {
      const key = monthKey(r.date);
      const prev = map.get(key) || { mortes: 0, ovos: 0 };
      prev.mortes += Number(r.quantity || 0);
      map.set(key, prev);
    }
    for (const r of eggRecords) {
      const key = monthKey(r.date);
      const prev = map.get(key) || { mortes: 0, ovos: 0 };
      prev.ovos += Number(r.goodEggs || 0);
      map.set(key, prev);
    }
    return Array.from(map, ([key, v]) => ({ key, month: monthLabel(key), ...v }))
      .sort((a, b) => (a.key > b.key ? 1 : -1))
      .slice(-12);
  }, [mortalityRecords, eggRecords]);

  // Alerta: mortalidade do mês corrente (completo ou em curso) vs média histórica dos meses anteriores.
  const mortalityAlert = useMemo(() => {
    if (byMonth.length < 2) return null;
    const current = byMonth[byMonth.length - 1];
    const history = byMonth.slice(0, -1);
    const avgHistoric = history.reduce((s, m) => s + m.mortes, 0) / history.length;
    if (avgHistoric <= 0) return null;
    const ratio = current.mortes / avgHistoric;
    if (ratio >= 1.3) {
      return {
        current: current.mortes,
        avg: Math.round(avgHistoric * 10) / 10,
        percentAbove: Math.round((ratio - 1) * 1000) / 10,
      };
    }
    return null;
  }, [byMonth]);

  // Custo médio de ração por ave: mês corrente vs mês anterior.
  const costByMonth = useMemo(() => {
    const map = new Map();
    for (const c of consumptionRecords) {
      if (c.costPerBird === null || c.costPerBird === undefined) continue;
      const key = monthKey(c.date);
      const prev = map.get(key) || { sum: 0, count: 0 };
      prev.sum += Number(c.costPerBird);
      prev.count += 1;
      map.set(key, prev);
    }
    return Array.from(map, ([key, v]) => ({ key, avgCostPerBird: v.sum / v.count })).sort((a, b) => (a.key > b.key ? 1 : -1));
  }, [consumptionRecords]);

  const currentCost = costByMonth[costByMonth.length - 1];
  const previousCost = costByMonth[costByMonth.length - 2];
  const costTrend =
    currentCost && previousCost && previousCost.avgCostPerBird > 0
      ? Math.round(((currentCost.avgCostPerBird - previousCost.avgCostPerBird) / previousCost.avgCostPerBird) * 1000) / 10
      : undefined;

  return (
    <div className="space-y-4">
      {mortalityAlert && (
        <div className="card p-4 flex items-start gap-3 bg-clay-50 border-clay-300 text-clay-700">
          <AlertTriangle className="size-5 mt-0.5 shrink-0" />
          <p className="text-sm">
            <strong>Mortalidade acima do padrão:</strong> {mortalityAlert.current} morte(s) neste mês, contra uma média
            histórica de {mortalityAlert.avg} — {mortalityAlert.percentAbove}% acima do normal.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-ink-300/40 bg-white shadow-sm">
          <CardContent className="p-5">
            <p className="text-sm font-medium text-muted-foreground">Custo médio de ração / ave (mês)</p>
            <div className="mt-2 flex items-end gap-2">
              <span className="text-2xl font-semibold tracking-tight text-ink-900">
                {currentCost ? currentCost.avgCostPerBird.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}
              </span>
              {typeof costTrend === 'number' && (
                <span className={`mb-1 text-xs font-medium ${costTrend <= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {costTrend > 0 ? '+' : ''}{costTrend}% vs mês anterior
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Média do custo de ração por ave ativa, nos registros de consumo do mês</p>
          </CardContent>
        </Card>
      </div>

      <ChartCard
        title="Mortalidade x produção de ovos"
        subtitle="Totais mensais — mortes (esquerda) e ovos bons coletados (direita)"
        isEmpty={byMonth.length === 0}
      >
        <ChartContainer
          config={{ mortes: { label: 'Mortes', color: 'var(--chart-5)' }, ovos: { label: 'Ovos', color: 'var(--chart-2)' } }}
          className="h-[300px] w-full"
        >
          <LineChart data={byMonth} margin={{ left: -10, right: 10, top: 8 }}>
            <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="var(--border)" />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={10} fontSize={11} />
            <YAxis yAxisId="left" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} allowDecimals={false} />
            <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
            <Tooltip content={<ChartTooltipContent />} />
            <Legend />
            <Line yAxisId="left" type="monotone" dataKey="mortes" stroke="var(--color-mortes)" strokeWidth={2.5} dot={{ r: 3 }} />
            <Line yAxisId="right" type="monotone" dataKey="ovos" stroke="var(--color-ovos)" strokeWidth={2.5} dot={{ r: 3 }} />
          </LineChart>
        </ChartContainer>
      </ChartCard>
    </div>
  );
}
