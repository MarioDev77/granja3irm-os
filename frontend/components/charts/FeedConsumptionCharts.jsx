'use client';

import { useMemo } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import ChartCard from './ChartCard';

const PIE_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];

function dayLabel(dateStr) {
  return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export default function FeedConsumptionCharts({ consumptions }) {
  const byDay = useMemo(() => {
    const map = new Map();
    for (const c of consumptions) {
      const key = dayLabel(c.date);
      const prev = map.get(key) || { quantidade: 0, custo: 0, sort: new Date(c.date).getTime() };
      prev.quantidade += Number(c.quantity || 0);
      prev.custo += Number(c.cost || 0);
      map.set(key, prev);
    }
    return Array.from(map, ([day, v]) => ({ day, ...v }))
      .sort((a, b) => a.sort - b.sort)
      .slice(-30);
  }, [consumptions]);

  const byFeed = useMemo(() => {
    const map = new Map();
    for (const c of consumptions) {
      const name = c.feed?.name || 'Sem ração';
      map.set(name, (map.get(name) || 0) + Number(c.quantity || 0));
    }
    return Array.from(map, ([name, quantidade]) => ({ name, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 6);
  }, [consumptions]);

  const byFlock = useMemo(() => {
    const map = new Map();
    for (const c of consumptions) {
      const name = c.flock?.name || 'Sem lote';
      map.set(name, (map.get(name) || 0) + Number(c.cost || 0));
    }
    return Array.from(map, ([name, custo]) => ({ name, custo })).sort((a, b) => b.custo - a.custo);
  }, [consumptions]);

  const totalCusto = byFlock.reduce((s, f) => s + f.custo, 0);

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <ChartCard title="Consumo de ração por dia" subtitle="Últimos registros, em quantidade (kg/un.)" isEmpty={byDay.length === 0} className="xl:col-span-2">
        <ChartContainer config={{ quantidade: { label: 'Quantidade', color: 'var(--chart-2)' } }} className="h-[260px] w-full">
          <AreaChart data={byDay} margin={{ left: -20, right: 4, top: 8 }}>
            <defs>
              <linearGradient id="fillConsumo" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-quantidade)" stopOpacity={0.22} />
                <stop offset="95%" stopColor="var(--color-quantidade)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="var(--border)" />
            <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={10} fontSize={11} />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
            <Tooltip content={<ChartTooltipContent />} />
            <Area type="monotone" dataKey="quantidade" stroke="var(--color-quantidade)" strokeWidth={2.5} fill="url(#fillConsumo)" />
          </AreaChart>
        </ChartContainer>
      </ChartCard>

      <ChartCard title="Consumo por tipo de ração" subtitle="Top 6, em quantidade total" isEmpty={byFeed.length === 0}>
        <ChartContainer config={{ quantidade: { label: 'Quantidade', color: 'var(--chart-3)' } }} className="h-[260px] w-full">
          <PieChart>
            <Tooltip content={<ChartTooltipContent />} />
            <Pie data={byFeed} dataKey="quantidade" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
              {byFeed.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
            </Pie>
          </PieChart>
        </ChartContainer>
      </ChartCard>

      <ChartCard
        title="Custo de ração por lote"
        subtitle={totalCusto > 0 ? `Total: ${totalCusto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : undefined}
        isEmpty={byFlock.length === 0 || byFlock.every((f) => f.custo === 0)}
        emptyText="Cadastre o preço médio das rações para ver o custo por lote."
      >
        <ChartContainer config={{ custo: { label: 'Custo (R$)', color: 'var(--chart-4)' } }} className="h-[260px] w-full">
          <BarChart data={byFlock} layout="vertical" margin={{ left: 16, right: 16, top: 8 }}>
            <CartesianGrid horizontal={false} strokeDasharray="4 4" stroke="var(--border)" />
            <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} />
            <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} fontSize={11} width={110} />
            <Tooltip content={<ChartTooltipContent />} />
            <Bar dataKey="custo" fill="var(--color-custo)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ChartContainer>
      </ChartCard>
    </div>
  );
}
