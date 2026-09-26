'use client';

import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import ChartCard from './ChartCard';

function dayLabel(dateStr) {
  return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

/**
 * entries: lançamentos manuais de caixa (INFLOW/OUTFLOW) do período (cash-flow API)
 * payables / receivables: listas de contas a pagar / receber (já carregadas na página)
 */
export default function FinanceCharts({ entries = [], payables = [], receivables = [] }) {
  const byDay = useMemo(() => {
    const map = new Map();
    for (const e of entries) {
      const key = dayLabel(e.date);
      const prev = map.get(key) || { entradas: 0, saidas: 0, sort: new Date(e.date).getTime() };
      if (e.type === 'INFLOW') prev.entradas += Number(e.value || 0);
      else prev.saidas += Number(e.value || 0);
      map.set(key, prev);
    }
    return Array.from(map, ([day, v]) => ({ day, ...v })).sort((a, b) => a.sort - b.sort);
  }, [entries]);

  const payableStatus = useMemo(() => {
    const map = new Map();
    for (const p of payables) map.set(p.status, (map.get(p.status) || 0) + Number(p.value || 0));
    const LABELS = { OPEN: 'Em aberto', OVERDUE: 'Vencida', PAID: 'Paga' };
    return Array.from(map, ([status, value]) => ({ status: LABELS[status] || status, value })).filter((r) => r.value > 0);
  }, [payables]);

  const receivableStatus = useMemo(() => {
    const map = new Map();
    for (const r of receivables) map.set(r.status, (map.get(r.status) || 0) + Number(r.value || 0));
    const LABELS = { OPEN: 'Em aberto', OVERDUE: 'Vencida', RECEIVED: 'Recebida' };
    return Array.from(map, ([status, value]) => ({ status: LABELS[status] || status, value })).filter((r) => r.value > 0);
  }, [receivables]);

  const STATUS_COLORS = { 'Em aberto': 'var(--chart-2)', Vencida: 'var(--chart-5)', Paga: 'var(--chart-1)', Recebida: 'var(--chart-1)' };

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <ChartCard
        title="Entradas x saídas de caixa"
        subtitle="Lançamentos manuais de fluxo de caixa no período"
        isEmpty={byDay.length === 0}
        emptyText="Nenhum lançamento manual de caixa no período selecionado."
        className="xl:col-span-2"
      >
        <ChartContainer
          config={{ entradas: { label: 'Entradas', color: 'var(--chart-1)' }, saidas: { label: 'Saídas', color: 'var(--chart-5)' } }}
          className="h-[280px] w-full"
        >
          <BarChart data={byDay} margin={{ left: -20, right: 4, top: 8 }}>
            <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="var(--border)" />
            <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={10} fontSize={11} />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
            <Tooltip content={<ChartTooltipContent />} />
            <Legend />
            <Bar dataKey="entradas" fill="var(--color-entradas)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="saidas" fill="var(--color-saidas)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </ChartCard>

      <ChartCard title="Contas a pagar por status" subtitle="Valor total por situação" isEmpty={payableStatus.length === 0}>
        <ChartContainer config={{ value: { label: 'Valor (R$)' } }} className="h-[240px] w-full">
          <PieChart>
            <Tooltip content={<ChartTooltipContent />} />
            <Pie data={payableStatus} dataKey="value" nameKey="status" innerRadius={45} outerRadius={85} paddingAngle={2}>
              {payableStatus.map((d, i) => <Cell key={i} fill={STATUS_COLORS[d.status] || `var(--chart-${(i % 5) + 1})`} />)}
            </Pie>
            <Legend />
          </PieChart>
        </ChartContainer>
      </ChartCard>

      <ChartCard title="Contas a receber por status" subtitle="Valor total por situação" isEmpty={receivableStatus.length === 0}>
        <ChartContainer config={{ value: { label: 'Valor (R$)' } }} className="h-[240px] w-full">
          <PieChart>
            <Tooltip content={<ChartTooltipContent />} />
            <Pie data={receivableStatus} dataKey="value" nameKey="status" innerRadius={45} outerRadius={85} paddingAngle={2}>
              {receivableStatus.map((d, i) => <Cell key={i} fill={STATUS_COLORS[d.status] || `var(--chart-${(i % 5) + 1})`} />)}
            </Pie>
            <Legend />
          </PieChart>
        </ChartContainer>
      </ChartCard>
    </div>
  );
}
